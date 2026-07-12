"""Transcribe a local Chinese meeting recording with the cached FunASR models."""

import argparse
import json
from pathlib import Path

from funasr import AutoModel


MODEL_ROOT = Path.home() / ".cache" / "modelscope" / "hub" / "models" / "iic"
ASR_MODEL = MODEL_ROOT / "speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
DEFAULT_HOTWORDS = "趣帆 趣帆学习空间 ClassIn 小程序 课堂小测 本讲总结 错题本 通关 荣誉 教务 插班 调班 退班 助教"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("output")
    parser.add_argument("--hotwords", default=DEFAULT_HOTWORDS)
    args = parser.parse_args()

    model = AutoModel(
        model=str(ASR_MODEL),
        device="cuda:0",
        disable_update=True,
    )
    result = model.generate(
        input=args.audio,
        batch_size_s=300,
        hotword=args.hotwords,
    )
    Path(args.output).write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
