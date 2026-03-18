import { useState, useRef, useEffect, useCallback } from "react";

export interface UseInputStateReturn {
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  cursorPosition: number;
  setCursorPosition: React.Dispatch<React.SetStateAction<number>>;
  inputValueRef: React.MutableRefObject<string>;
  cursorRef: React.MutableRefObject<number>;
  isPastingRef: React.MutableRefObject<boolean>;
  lastPasteEndRef: React.MutableRefObject<number>;
  pasteBufferRef: React.MutableRefObject<string>;
  resetInput: () => void;
}

export function useInputState(): UseInputStateReturn {
  const [inputValue, setInputValue] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);

  const inputValueRef = useRef(inputValue);
  const cursorRef = useRef(cursorPosition);
  const isPastingRef = useRef(false);
  const lastPasteEndRef = useRef(0);
  const pasteBufferRef = useRef("");

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    cursorRef.current = cursorPosition;
  }, [cursorPosition]);

  const resetInput = useCallback(() => {
    inputValueRef.current = "";
    cursorRef.current = 0;
    setInputValue("");
    setCursorPosition(0);
  }, []);

  return {
    inputValue,
    setInputValue,
    cursorPosition,
    setCursorPosition,
    inputValueRef,
    cursorRef,
    isPastingRef,
    lastPasteEndRef,
    pasteBufferRef,
    resetInput,
  };
}
