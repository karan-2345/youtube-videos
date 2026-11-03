"""Add Kokoro's per-phoneme duration tensor as a second graph output (for word timings).

    python tools/patch_model.py   assets/models/kokoro-v1.0.onnx -> assets/models/kokoro-v1.0-dur.onnx
"""
import os

import onnx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/models/kokoro-v1.0.onnx")
DST = os.path.join(ROOT, "assets/models/kokoro-v1.0-dur.onnx")
NAME = "/encoder/Clip_output_0"

m = onnx.load(SRC)
if NAME not in {n for node in m.graph.node for n in node.output}:
    raise SystemExit(f"{NAME} not found in the graph")
m.graph.output.append(onnx.helper.make_tensor_value_info(NAME, onnx.TensorProto.FLOAT, None))
onnx.save(m, DST)
print("wrote", DST)
