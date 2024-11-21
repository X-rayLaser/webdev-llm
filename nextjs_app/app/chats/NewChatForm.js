"use client"
import React, { useState, useEffect, useRef } from "react";


function getTextWidth(text, font) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
  
    context.font = font || getComputedStyle(document.body).font;
  
    return context.measureText(text).width;
}


const NewChatForm = () => {
  const [text, setText] = useState("");
  const [rows, setRows] = useState(1);
  const [textAreaEffectiveWidth, setTextAreaEffectiveWidth] = useState(0);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const textareaWidth = textarea.offsetWidth;

      // Get computed styles to account for padding and borders
      const style = getComputedStyle(textarea);
      const padding =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const border =
        parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);

      // Effective width after subtracting padding and borders
      const effectiveWidth = textareaWidth - padding - border;
      setTextAreaEffectiveWidth(effectiveWidth)
    }
  }, [textareaRef]);

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setText(newText);

    // Calculate rows needed based on text and max characters per line
    const lineCount = newText.split("\n").length;
    const textWithoutBreaks = newText.replace(/\n/g, "");
    const font = getComputedStyle(textareaRef.current).font;
    const textWidth = getTextWidth(textWithoutBreaks, font);
    const extraRows = Math.ceil(textWidth / textAreaEffectiveWidth)
    //todo: add optionall word-wrap:break-word; word-break:break-all; to allow breaking word when wrapping text

    setRows(Math.max(lineCount + extraRows, 1));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted:", { configuration, text });
  };

  const [configuration, setConfiguration] = useState("");

  const handleConfigurationChange = (e) => {
    setConfiguration(e.target.value);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full md:w-1/2 mx-auto">
      <div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          rows={rows}
          className="border p-2 w-full rounded"
          placeholder="Type here..."
        />
      </div>
      <div className="flex items-center mb-4">
        <label htmlFor="configuration" className="mr-4 font-medium">
          Configuration:
        </label>
        <select
          id="configuration"
          value={configuration}
          onChange={handleConfigurationChange}
          className="border px-3 py-2 rounded mr-4 w-full sm:w-auto shrink"
          required
        >
          <option value="" disabled>
            Select a configuration
          </option>
          <option value="config1">Configuration 1</option>
          <option value="config2">Configuration 2</option>
          <option value="config3">Configuration 3</option>
        </select>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Submit
        </button>
      </div>
    </form>
  );
};

export default NewChatForm;
