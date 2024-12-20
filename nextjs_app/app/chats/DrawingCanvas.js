"use client"
import React, { useRef, useState } from "react";
import { Alert } from "../components/alerts";
import { SubmitButton, OutlineButton } from "../components/buttons";

const DrawingCanvas = ({ action, onSuccess }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [runningSubmission, setRunningSubmission] = useState(false);
  const [error, setError] = useState("");

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(
      e.nativeEvent.offsetX,
      e.nativeEvent.offsetY
    );
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineTo(
      e.nativeEvent.offsetX,
      e.nativeEvent.offsetY
    );
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const decoratedAction = async (formData) => {
    const canvas = canvasRef.current;
    const promise = new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        formData.append("image", blob, "canvas_drawing.png");
        action(null, formData).then(resolve).catch(reject);
      }, "image/png");
    });

    let res = await promise;

    setRunningSubmission(false);
    if (res.success) {
        onSuccess(res);
    } else {
        console.error("error", res.responseData)
        setError(res.responseData.message);
    }
  }

  function handleSubmit(e) {
    setRunningSubmission(true);
  }

  return (
    <form action={decoratedAction} className="drawing-canvas-container" onSubmit={handleSubmit}>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ border: "1px solid #000" }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      ></canvas>
      <div className="flex gap-2 mt-2">
        <OutlineButton
          type="button"
          onClick={clearCanvas}
          disabled={runningSubmission}
        >
          Clear
        </OutlineButton>
        <SubmitButton
          type="submit"
          disabled={runningSubmission}
        >
        </SubmitButton>
      </div>
      {error && (
        <div className="mt-5 mb-5">
            <Alert text={error} level="danger" />
        </div>
      )}
    </form>
  );
};

export default DrawingCanvas;
