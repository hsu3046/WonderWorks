#!/usr/bin/env python3
"""Finalize direct H.264 canvas recordings without another lossy encoding pass.
SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
Usage: python3 scripts/finalize-hq-previews.py <recording-directory> [clip-name ...]
"""
import json
from pathlib import Path
import subprocess
import sys

source = Path(sys.argv[1]).resolve()
output = Path(__file__).resolve().parents[1] / 'public/media/previews'
names = sys.argv[2:] or ['shabon', 'ocean', 'citrus-dynamic', 'melon-dynamic', 'chroma', 'harbor', 'foliage']
report = {}
for name in names:
    recording = source / (name + '.mp4')
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,bit_rate,avg_frame_rate', '-show_entries', 'format=duration,size', '-of', 'json', str(recording)]))
    video = info['streams'][0]
    if video['codec_name'] != 'h264' or (video['width'], video['height']) != (1536, 1024):
        raise ValueError(f'{name}: unexpected video format {video}')
    movie = output / (name + '-hq.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(recording), '-map', '0:v:0', '-c:v', 'copy', '-an', '-movflags', '+faststart', str(movie)], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(movie), '-frames:v', '1', '-q:v', '2', str(output / (name + '-hq.jpg'))], check=True)
    report[name] = info
(source / 'after.json').write_text(json.dumps(report, indent=2))
print(f'Finalized {len(names)} 1536×1024 MP4 previews with stream copy (no video re-encoding).')
