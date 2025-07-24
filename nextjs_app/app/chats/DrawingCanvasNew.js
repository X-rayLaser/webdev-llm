import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ButtonGroup, ButtonDropdown, GroupButton, CancelButton, SubmitButton } from '../components/buttons';
import { capitalize } from '@/app/utils';

const ToolsDropdown = ({ options, value, onSelect }) => {
  const makeAction = useCallback((actionName, instruction) => ({
    name: actionName,
    label: capitalize(actionName),
    onSelect: () => onSelect(actionName, instruction)
  }));

  const actions = options.map(opt => makeAction(opt));

  const defaultAction = actions.filter(action => action.name === value)[0];
  return <ButtonDropdown actions={actions} defaultAction={defaultAction} />;
}


const DrawingCanvas = ({ action, onSuccess }) => {
  const canvasRef = useRef(null);
  const [currentTool, setCurrentTool] = useState('free'); // 'free', 'line', 'bar', 'rectangle', 'square', 'text', 'eraser'
  const [barOrientation, setBarOrientation] = useState('horizontal'); // used only when tool is 'bar'
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [previewShape, setPreviewShape] = useState(null);
  const [history, setHistory] = useState({
    shapes: [],
    insertIndex: 0
  });
  //const [redoStack, setRedoStack] = useState([]);
  const [instructions, setInstructions] = useState('Select a tool and click on the canvas to begin.');
  const [cursorPos, setCursorPos] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redraw the canvas based on history, preview shape and crosshair
  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    redrawHistory(canvas, history);

    if (previewShape) drawShape(ctx, previewShape);
    if (cursorPos) drawCrosshair(ctx, cursorPos);
  }, [history, previewShape, cursorPos]);

  // useEffect to redraw when dependencies change
  useEffect(() => {
    drawAll();
  }, [drawAll]);

  const redrawHistory = (canvas, history) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shapes = history.shapes.slice(0, history.insertIndex);
    shapes.forEach(item => drawShape(ctx, item));
  }

  // Helper: Draw a shape based on its type
  const drawShape = (ctx, shape) => {
    ctx.save();
    switch (shape.type) {
      case 'free': {
        ctx.beginPath();
        shape.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(shape.start.x, shape.start.y);
        ctx.lineTo(shape.end.x, shape.end.y);
        ctx.stroke();
        break;
      }
      case 'bar': {
        if (shape.orientation === 'horizontal') {
          ctx.beginPath();
          ctx.moveTo(0, shape.point.y);
          ctx.lineTo(canvasRef.current.width, shape.point.y);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(shape.point.x, 0);
          ctx.lineTo(shape.point.x, canvasRef.current.height);
          ctx.stroke();
        }
        break;
      }
      case 'rectangle': {
        const x = Math.min(shape.start.x, shape.end.x);
        const y = Math.min(shape.start.y, shape.end.y);
        const w = Math.abs(shape.end.x - shape.start.x);
        const h = Math.abs(shape.end.y - shape.start.y);
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'square': {
        const side = Math.max(
          Math.abs(shape.end.x - shape.start.x),
          Math.abs(shape.end.y - shape.start.y)
        );
        const startX = shape.start.x;
        const startY = shape.start.y;
        const x = shape.end.x >= startX ? startX : startX - side;
        const y = shape.end.y >= startY ? startY : startY - side;
        ctx.strokeRect(x, y, side, side);
        break;
      }
      case 'text': {
        ctx.fillText(shape.text, shape.position.x, shape.position.y);
        break;
      }
      case 'eraser': {
        // Use destination-out to simulate erasing
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(shape.position.x, shape.position.y, shape.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      default:
        break;
    }
    ctx.restore();
  };

  // Helper: Draw crosshair at current cursor position
  const drawCrosshair = (ctx, pos) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    // horizontal line
    ctx.beginPath();
    ctx.moveTo(0, pos.y);
    ctx.lineTo(canvasRef.current.width, pos.y);
    ctx.stroke();
    // vertical line
    ctx.beginPath();
    ctx.moveTo(pos.x, 0);
    ctx.lineTo(pos.x, canvasRef.current.height);
    ctx.stroke();
    // draw a bold point
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Resets the current drawing state
  const resetDrawing = () => {
    setStartPoint(null);
    setPreviewShape(null);
    setIsDrawing(false);
    setInstructions('Select a tool and click on the canvas.');
  };

  // Adds a finalized shape to the history and clears redo stack
  const addHistory = (shape) => {
    setHistory((prev) => {
      const shapes = prev.shapes.slice(0, prev.insertIndex);
      shapes[prev.insertIndex] = shape;
      return {
        shapes,
        insertIndex: prev.insertIndex + 1
      };
    })
  };

  // --- Event Handlers ---

  const handleCanvasDown = (x, y) => {
    const point = { x, y };
    if (currentTool === 'free') {
      if (!isDrawing) {
        setStartPoint(point);
        setPreviewShape({ type: 'free', points: [point] });
        setInstructions('Free draw: move mouse to add points, click again to finish.');
        setIsDrawing(true);
      } else {
        // finalize free shape
        if (previewShape.points.length > 1) {
          addHistory(previewShape);
          resetDrawing();
        }
      }
    } else if (currentTool === 'line') {
      if (!isDrawing) {
        setStartPoint(point);
        setPreviewShape({ type: 'line', start: point, end: point });
        setInstructions('Line: move to second endpoint and click to finalize.');
        setIsDrawing(true);
      } else {
        addHistory({ type: 'line', start: startPoint, end: point });
        resetDrawing();
      }
    } else if (currentTool === 'bar') {
      // For simplicity, draw full-length bar (collision logic could be added)
      addHistory({ type: 'bar', orientation: barOrientation, point });
      setInstructions(`Placed ${barOrientation} bar.`);
    } else if (currentTool === 'rectangle') {
      if (!isDrawing) {
        setStartPoint(point);
        setPreviewShape({ type: 'rectangle', start: point, end: point });
        setInstructions('Rectangle: move to opposite corner and click to finalize.');
        setIsDrawing(true);
      } else {
        addHistory({ type: 'rectangle', start: startPoint, end: point });
        resetDrawing();
      }
    } else if (currentTool === 'square') {
      if (!isDrawing) {
        setStartPoint(point);
        setPreviewShape({ type: 'square', start: point, end: point });
        setInstructions('Square: move to set size and click to finalize.');
        setIsDrawing(true);
      } else {
        addHistory({ type: 'square', start: startPoint, end: point });
        resetDrawing();
      }
    } else if (currentTool === 'text') {
      const userText = prompt('Enter text:');
      if (userText) {
        addHistory({ type: 'text', text: userText, position: point });
      }
    } else if (currentTool === 'eraser') {
      addHistory({ type: 'eraser', position: point, radius: 10 });
    }
  };

  const handleMouseDown = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    handleCanvasDown(offsetX, offsetY);
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursorPos({ x, y });
    if (isDrawing && previewShape) {
      if (['line', 'rectangle', 'square'].includes(currentTool)) {
        setPreviewShape((prev) => ({ ...prev, end: { x, y } }));
      } else if (currentTool === 'free') {
        // add point to free shape preview
        setPreviewShape((prev) => ({ ...prev, points: [...prev.points, { x, y }] }));
      }
    }
  };

  // For mouseUp we use it to support touch-end and finalize free draw on release
  const handleMouseUp = () => {
    if (currentTool === 'free' && isDrawing && previewShape.points.length > 1) {
      addHistory(previewShape);
      resetDrawing();
    }
  };

  // Touch event handlers mimic mouse events
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    handleCanvasDown(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const fakeEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      nativeEvent: { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top },
    };
    handleMouseMove(fakeEvent);
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  // --- Toolbar Actions ---

  const handleUndo = () => {
    setHistory((prev) => {
      if (prev.insertIndex === 0) {
        return prev;
      }
      return {...prev, insertIndex: prev.insertIndex - 1 };
    });
  };

  const handleRedo = () => {
    setHistory((prev) => {
      if (prev.insertIndex >= prev.shapes.length) {
        return prev;
      }
      return {...prev, insertIndex: prev.insertIndex + 1 };
    });
  };

  const handleClear = () => {
    setHistory({ shapes: [], insertIndex: 0 });
  };

  const handleCancel = () => {
    resetDrawing();
  };

  // Submit: convert canvas to image and call callbacks
  const decoratedAction = async (formData) => {
    const canvas = canvasRef.current;
    redrawHistory(canvas, history);

    const promise = new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        formData.append("image", blob, "canvas_drawing.png");
        action(null, formData).then(resolve).catch(reject);
      }, "image/png");
    });

    let res = await promise;

    setIsSubmitting(false);
    if (res.success) {
        onSuccess(res);
    } else {
        console.error("error", res.responseData)
        setError(res.responseData.message);
    }
  }

  function handleSubmit(e) {
    setIsSubmitting(true);
  }

  // Toggle bar orientation when in bar mode
  const toggleBarOrientation = () => {
    setBarOrientation((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
    setInstructions(`Bar tool: now set to ${barOrientation === 'horizontal' ? 'vertical' : 'horizontal'}. Click to place.`);
  };

  const instructionMap = {
    'free': 'Free Draw: click to start drawing.',
    'line': 'Line: click to set first endpoint.',
    'bar': 'Bar: click to place a bar. Use toggle to change orientation.',
    'rectangle': 'Rectangle: click to set first corner.',
    'square': 'Square: click to set first corner.',
    'text': 'Text: click to place text.',
    'eraser': 'Eraser: click to erase.'
  };

  const drawAction = useCallback(newTool => {
    const newInstructions = instructionMap[newTool];
    setCurrentTool(newTool);
    resetDrawing();
    setInstructions(newInstructions);
  });

  const toolOptions = Object.keys(instructionMap);

  return (
    <form action={decoratedAction} className="flex flex-col items-center p-2 gap-4" onSubmit={handleSubmit}>
      {/* Toolbar */}

      <div className="flex gap-2 items-center">
        <span>Tools: </span>
        <ToolsDropdown options={toolOptions} onSelect={drawAction} value={currentTool} />
        <ButtonGroup>
          {currentTool === 'bar' && (
            <GroupButton onClick={toggleBarOrientation} type="button">
              {barOrientation === 'horizontal' ? 'Horizontal' : 'Vertical' }
            </GroupButton>
          )}
          
          <GroupButton type="button" onClick={handleUndo}>
            Undo
          </GroupButton>
          <GroupButton type="button" onClick={handleRedo}>
            Redo
          </GroupButton>
          <GroupButton type="button" onClick={handleClear}>
            Clear
          </GroupButton>
          <GroupButton type="button" onClick={handleCancel}>Cancel</GroupButton>
        </ButtonGroup>

        <SubmitButton text="Submit">
          {isSubmitting ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 rounded-full" />
          ) : (
            ''
          )}
        </SubmitButton>
      </div>
      {/* Instructions */}
      <div className="text-sm text-gray-600">{instructions}</div>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="border"
        width={800}
        height={600}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </form>
  );
};

export default DrawingCanvas;
