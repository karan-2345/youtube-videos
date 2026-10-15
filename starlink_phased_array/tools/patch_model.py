"""Expose Kokoro's per-phoneme durations as a second ONNX output.

kokoro-v1.0.onnx only returns audio. Inside the graph, `/encoder/Clip_output_0`
holds the predicted duration (in model frames) of every input token, which is
what gives exact word start/end times for captions and animation cues.

    python tools/patch_model.py
      assets/models/kokoro-v1.0.onnx -> assets/models/kokoro-v1.0-dur.onnx
"""
import os

import onnx
from onnx import TensorProto, helper

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/models/kokoro-v1.0.onnx")
DST = os.path.join(ROOT, "assets/models/kokoro-v1.0-dur.onnx")
TENSOR = "/encoder/Clip_output_0"


def main():
    model = onnx.load(SRC)
    produced = {o for n in model.graph.node for o in n.output}
    if TENSOR not in produced:
        near = sorted(o for o in produced if "Clip" in o)[:10]
        raise SystemExit(f"{TENSOR} not found in graph; Clip outputs seen: {near}")
    model.graph.output.append(helper.make_tensor_value_info(TENSOR, TensorProto.FLOAT, None))
    onnx.save(model, DST)
    print("outputs:", [o.name for o in model.graph.output], "->", DST)


if __name__ == "__main__":
    main()
