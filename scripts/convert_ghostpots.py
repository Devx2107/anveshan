"""Convert the PINGEcosystem ghost-pot HF dataset to YOLO detection format."""

import argparse
import json
from pathlib import Path
import shutil

from PIL import Image


SPLITS = ("train", "valid", "test")


def convert(source: Path, output: Path, include_maybe: bool = False) -> None:
    if output.exists() and any(output.iterdir()):
        raise SystemExit(f"Output folder is not empty: {output}\nChoose a new folder or move its contents first.")

    for split in SPLITS:
        source_split = source / split
        metadata_path = source_split / "metadata.jsonl"
        if not metadata_path.is_file():
            raise SystemExit(f"Missing expected split metadata: {metadata_path}")

        image_out = output / split / "images"
        label_out = output / split / "labels"
        image_out.mkdir(parents=True, exist_ok=True)
        label_out.mkdir(parents=True, exist_ok=True)
        converted = 0

        with metadata_path.open("r", encoding="utf-8") as metadata:
            for line_number, line in enumerate(metadata, start=1):
                if not line.strip():
                    continue
                record = json.loads(line)
                filename = record["file_name"]
                image_path = source_split / filename
                if not image_path.is_file():
                    raise SystemExit(f"Image not found at {metadata_path}:{line_number}: {image_path}")

                relative = Path(filename)
                image_target = image_out / relative
                label_target = label_out / relative.with_suffix(".txt")
                image_target.parent.mkdir(parents=True, exist_ok=True)
                label_target.parent.mkdir(parents=True, exist_ok=True)

                objects = record.get("objects", {})
                boxes = objects.get("bbox", [])
                categories = objects.get("category", [])
                if len(boxes) != len(categories):
                    raise SystemExit(f"Mismatched boxes/categories at {metadata_path}:{line_number}")

                with Image.open(image_path) as image:
                    width, height = image.size
                yolo_rows = []
                for box, category in zip(boxes, categories):
                    normalized_category = str(category).strip().casefold().replace("_", "-")
                    if normalized_category == "crab-pot":
                        pass
                    elif include_maybe and normalized_category == "maybe-crab-pot":
                        pass
                    else:
                        continue

                    x, y, box_width, box_height = map(float, box)
                    if width <= 0 or height <= 0 or box_width <= 0 or box_height <= 0:
                        continue
                    x_center = (x + box_width / 2) / width
                    y_center = (y + box_height / 2) / height
                    yolo_width = box_width / width
                    yolo_height = box_height / height
                    yolo_rows.append(
                        f"0 {x_center:.6f} {y_center:.6f} {yolo_width:.6f} {yolo_height:.6f}"
                    )

                shutil.copy2(image_path, image_target)
                # An empty label file marks a valid background image for YOLO.
                label_target.write_text("\n".join(yolo_rows), encoding="utf-8")
                converted += 1

        print(f"{split}: converted {converted} images to {image_out}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Hugging Face dataset folder")
    parser.add_argument("--output", type=Path, required=True, help="New YOLO dataset folder")
    parser.add_argument(
        "--include-maybe", action="store_true",
        help="Include the ambiguous Maybe-Crab-Pot annotations as class 0",
    )
    args = parser.parse_args()
    convert(args.source, args.output, args.include_maybe)


if __name__ == "__main__":
    main()
