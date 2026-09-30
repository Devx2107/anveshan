"""Convert AI4Shipwrecks binary masks into a cropped YOLO detection dataset."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import cv2
import numpy as np

IMAGE_DIRS = {
    "train": Path("train/images"),
    "val": Path("train/images"),
    "test": Path("test/images"),
}
LABEL_DIRS = {
    "train": Path("train/labels"),
    "val": Path("train/labels"),
    "test": Path("test/labels"),
}


def site_name(stem: str) -> str:
    """Return the survey/site prefix before the final numeric image index."""
    return re.sub(r"_\d+$", "", stem)


def tile_starts(length: int, side: int, stride: int) -> list[int]:
    """Choose overlapping crop offsets along one axis and include the far edge."""
    if length <= side:
        return [0]
    starts = list(range(0, length - side + 1, stride))
    final_start = length - side
    if starts[-1] != final_start:
        starts.append(final_start)
    return starts


def mask_to_yolo(mask: np.ndarray) -> list[str]:
    """Convert each connected positive mask region to a normalized YOLO box."""
    binary = (mask > 0).astype(np.uint8)
    count, _, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    height, width = binary.shape
    rows = []

    for x, y, box_width, box_height, _area in stats[1:count]:
        center_x = (x + box_width / 2) / width
        center_y = (y + box_height / 2) / height
        rows.append(
            f"0 {center_x:.6f} {center_y:.6f} "
            f"{box_width / width:.6f} {box_height / height:.6f}"
        )
    return rows


def convert_pair(
    image_path: Path,
    mask_path: Path,
    image_out: Path,
    label_out: Path,
    prefix: str,
    side: int,
    stride: int,
) -> int:
    image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
    if image is None or mask is None:
        raise SystemExit(f"Could not read image/mask pair: {image_path} / {mask_path}")
    if image.shape != mask.shape:
        raise SystemExit(
            f"Image/mask dimensions differ: {image_path} {image.shape}, "
            f"{mask_path} {mask.shape}"
        )

    height, width = image.shape
    pad_bottom = max(0, side - height)
    pad_right = max(0, side - width)
    if pad_bottom or pad_right:
        image = cv2.copyMakeBorder(
            image, 0, pad_bottom, 0, pad_right, cv2.BORDER_CONSTANT, value=0,
        )
        mask = cv2.copyMakeBorder(
            mask, 0, pad_bottom, 0, pad_right, cv2.BORDER_CONSTANT, value=0,
        )

    written = 0
    row_starts = tile_starts(image.shape[0], side, stride)
    col_starts = tile_starts(image.shape[1], side, stride)
    for row_index, y_start in enumerate(row_starts):
        for col_index, x_start in enumerate(col_starts):
            image_tile = image[y_start : y_start + side, x_start : x_start + side]
            mask_tile = mask[y_start : y_start + side, x_start : x_start + side]
            tile_stem = f"{prefix}__{image_path.stem}__r{row_index:02d}_c{col_index:02d}"
            image_path_out = image_out / f"{tile_stem}.png"
            label_path_out = label_out / f"{tile_stem}.txt"
            if not cv2.imwrite(str(image_path_out), image_tile):
                raise SystemExit(f"Could not write image tile: {image_path_out}")
            label_path_out.write_text("\n".join(mask_to_yolo(mask_tile)), encoding="utf-8")
            written += 1
    return written


def convert(source: Path, output: Path, val_site: str, tile_size: int, stride: int) -> None:
    if output.exists() and any(output.iterdir()):
        raise SystemExit(f"Output folder is not empty: {output}\nChoose an empty output folder.")
    if stride <= 0 or stride > tile_size:
        raise SystemExit("--stride must be greater than 0 and no larger than --tile-size.")

    train_source = source / "train"
    test_source = source / "test"
    terrain_source = source / "extras" / "terrain"
    for split_dir in (train_source, test_source):
        if not (split_dir / "images").is_dir() or not (split_dir / "labels").is_dir():
            raise SystemExit(f"Expected images/ and labels/ folders under {split_dir}")

    groups = {
        "train": [],
        "val": [],
        "test": [],
    }
    for image_path in sorted((train_source / "images").glob("*.png")):
        group = "val" if site_name(image_path.stem) == val_site else "train"
        groups[group].append((image_path, train_source / "labels" / image_path.name))
    groups["test"] = [
        (image_path, test_source / "labels" / image_path.name)
        for image_path in sorted((test_source / "images").glob("*.png"))
    ]
    if not groups["val"]:
        available = sorted({site_name(p.stem) for p in (train_source / "images").glob("*.png")})
        raise SystemExit(f"Validation site '{val_site}' not found. Available sites: {available}")
    if not groups["train"] or not groups["test"]:
        raise SystemExit("Expected non-empty training and official test image folders.")

    for image_path, label_path in [*groups["train"], *groups["val"], *groups["test"]]:
        if not label_path.is_file():
            raise SystemExit(f"Missing mask for image: {image_path} (expected {label_path})")

    if terrain_source.exists():
        terrain_images = terrain_source / "images"
        terrain_labels = terrain_source / "labels"
        if terrain_images.is_dir() and terrain_labels.is_dir():
            for image_path in sorted(terrain_images.glob("*.png")):
                mask_path = terrain_labels / image_path.name
                if not mask_path.is_file():
                    raise SystemExit(f"Missing terrain mask: {mask_path}")
                groups["train"].append((image_path, mask_path))

    output.mkdir(parents=True, exist_ok=True)
    tile_counts = {split: 0 for split in groups}
    source_counts = {split: 0 for split in groups}
    for split, pairs in groups.items():
        image_out = output / split / "images"
        label_out = output / split / "labels"
        image_out.mkdir(parents=True, exist_ok=True)
        label_out.mkdir(parents=True, exist_ok=True)
        for image_path, mask_path in pairs:
            prefix = "terrain" if terrain_source in image_path.parents else split
            tile_counts[split] += convert_pair(
                image_path, mask_path, image_out, label_out,
                prefix, tile_size, stride,
            )
            source_counts[split] += 1

    yaml_path = output / "data.yaml"
    yaml_path.write_text(
        f"path: {output.resolve().as_posix()}\n"
        "train: train/images\n"
        "val: val/images\n"
        "test: test/images\n\n"
        "names:\n"
        "  0: marine_anomaly\n",
        encoding="utf-8",
    )
    for split in ("train", "val", "test"):
        print(f"{split}: {source_counts[split]} source images -> {tile_counts[split]} tiles")
    print(f"YOLO config: {yaml_path}")
    print(f"Validation held out by site: {val_site}")
    print("The official test split was kept separate; do not train on it.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Extracted AI4Shipwrecks folder")
    parser.add_argument("--output", type=Path, required=True, help="New output folder outside the Git repo")
    parser.add_argument(
        "--val-site", default="DM_Wilson",
        help="Whole training site reserved for validation (default: DM_Wilson)",
    )
    parser.add_argument("--tile-size", type=int, default=1728)
    parser.add_argument("--stride", type=int, default=864)
    args = parser.parse_args()
    convert(args.source, args.output, args.val_site, args.tile_size, args.stride)


if __name__ == "__main__":
    main()
