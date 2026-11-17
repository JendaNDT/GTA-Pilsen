#!/usr/bin/env python3
"""Vytvoří místní česká hlášení a přesné časy klipů uvnitř zvukových souborů."""
import argparse
import json
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory

import imageio_ffmpeg
import numpy as np
from piper import PiperVoice, SynthesisConfig

PER_PACK = 44


def pronounced(name):
    for short, long in (("NC", "nákupní centrum"), ("FN", "fakultní nemocnice"), ("ZŠ", "základní škola"),
                        ("CAN", "centrální autobusové nádraží"), ("ČD", "České dráhy")):
        name = re.sub(r"\b" + short + r"\b", long, name)
    for short, long in (("nám.", "náměstí"), ("rozc.", "rozcestí"), ("žel. st.", "železniční stanice"),
                        ("žel. zast.", "železniční zastávka"), ("křiž.", "křižovatka")):
        name = name.replace(short, long)
    return name.rstrip(".") + "."


def synthesize(voice, name):
    config = SynthesisConfig(length_scale=1.01, noise_scale=0, noise_w_scale=0)
    parts = [chunk.audio_float_array for chunk in voice.synthesize(pronounced(name), config)]
    pcm = np.concatenate(parts)
    if not len(pcm) or not np.isfinite(pcm).all():
        raise ValueError(f"Chybný klip {name}")
    speak = np.flatnonzero(np.abs(pcm) > 0.008)
    if not len(speak):
        raise ValueError(f"Tichý klip {name}")
    rate = voice.config.sample_rate
    pcm = pcm[max(0, speak[0] - int(rate * 0.055)):speak[-1] + int(rate * 0.16)]
    # Vrchol -3 dBFS a mírná komprese při ozvučení z reproduktoru vozu.
    pcm = np.tanh(pcm * 1.25)
    pcm *= 0.68 / np.max(np.abs(pcm))
    return (pcm * 32767).astype("<i2")


def build(timetable, model, output):
    names = sorted({stop[0] for stop in json.loads(timetable.read_text(encoding="utf-8"))["stops"]})
    if not names:
        raise ValueError("Jízdní řád nemá zastávky")
    voice = PiperVoice.load(model)
    rate = voice.config.sample_rate
    guard = np.zeros(int(rate * 0.22), dtype="<i2")
    clips = {}
    with TemporaryDirectory(dir=output.parent) as directory:
        temp = Path(directory)
        for k, index in enumerate(range(0, len(names), PER_PACK)):
            path = f"hlasky-{k:02}.mp3"
            offset = len(guard)
            samples = [guard]
            for name in names[index:index + PER_PACK]:
                pcm = synthesize(voice, name)
                clips[name] = [path, round(offset / rate, 6), round(len(pcm) / rate, 6)]
                samples.extend((pcm, guard))
                offset += len(pcm) + len(guard)
            subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
                            "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0",
                            "-codec:a", "libmp3lame", "-b:a", "48k", str(temp / path)],
                           input=np.concatenate(samples).tobytes(), check=True)
            print(f"{path} – {min(index + PER_PACK, len(names))}/{len(names)} hlášení", flush=True)
        manifest = {"version": 1, "sampleRate": rate, "clips": clips}
        (temp / "stops.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n",
                                          encoding="utf-8")
        output.mkdir(exist_ok=True)
        for name in sorted(temp.iterdir(), key=lambda path: path.name == "stops.json"):
            name.replace(output / name.name)
    return len(clips)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("--timetable", type=Path, default=Path("public/data/timetable.json"))
    parser.add_argument("--output", type=Path, default=Path("public/audio"))
    args = parser.parse_args()
    print(f"Hlášení: {build(args.timetable, args.model, args.output)}")


if __name__ == "__main__":
    main()
