import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { decrement, increment } from "./PanelSlice";
import "./Panel.css";

export default function Panel() {
  const count = useSelector((state) => state.panel.value);
  const dispatch = useDispatch();

  return (
    <div className="Panel">
      <div>
        <button
          aria-label="Increment value"
          onClick={() => dispatch(increment())}
        >
          Increment
        </button>
        <span>{count}</span>
        <button
          aria-label="Decrement value"
          onClick={() => dispatch(decrement())}
        >
          Decrement
        </button>
      </div>
    </div>
  );
}
