import { useReducer } from "react";

// State shape for sequence creation/editing form
export interface SequenceFormState {
  // Form data
  name: string;
  script: string;
  selectedStyleId: string | null;

  // UI state
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  validationErrors: {
    name?: string;
    script?: string;
    style?: string;
  };

  // Submission state
  isSubmitting: boolean;
  submitError: string | null;

  // Flow state
  currentStep: "script" | "style" | "storyboard";
  completedSteps: Set<string>;
}

// Action types
export type SequenceFormAction =
  | { type: "SET_NAME"; payload: string }
  | { type: "SET_SCRIPT"; payload: string }
  | { type: "SET_SELECTED_STYLE"; payload: string | null }
  | { type: "SET_CURRENT_STEP"; payload: SequenceFormState["currentStep"] }
  | { type: "MARK_STEP_COMPLETED"; payload: string }
  | { type: "SET_EDITING"; payload: boolean }
  | {
      type: "SET_VALIDATION_ERRORS";
      payload: SequenceFormState["validationErrors"];
    }
  | { type: "CLEAR_VALIDATION_ERRORS" }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_SUBMIT_ERROR"; payload: string | null }
  | { type: "RESET_FORM" }
  | {
      type: "LOAD_SEQUENCE";
      payload: { name: string; script: string; styleId: string | null };
    };

// Initial state
export const initialSequenceFormState: SequenceFormState = {
  name: "",
  script: "",
  selectedStyleId: null,
  isEditing: false,
  hasUnsavedChanges: false,
  validationErrors: {},
  isSubmitting: false,
  submitError: null,
  currentStep: "script",
  completedSteps: new Set(),
};

// Reducer function
export function sequenceFormReducer(
  state: SequenceFormState,
  action: SequenceFormAction,
): SequenceFormState {
  switch (action.type) {
    case "SET_NAME":
      return {
        ...state,
        name: action.payload,
        hasUnsavedChanges: true,
        validationErrors: {
          ...state.validationErrors,
          name: undefined, // Clear error when user starts typing
        },
      };

    case "SET_SCRIPT":
      return {
        ...state,
        script: action.payload,
        hasUnsavedChanges: true,
        validationErrors: {
          ...state.validationErrors,
          script: undefined,
        },
      };

    case "SET_SELECTED_STYLE":
      return {
        ...state,
        selectedStyleId: action.payload,
        hasUnsavedChanges: true,
      };

    case "SET_CURRENT_STEP":
      return {
        ...state,
        currentStep: action.payload,
      };

    case "MARK_STEP_COMPLETED":
      return {
        ...state,
        completedSteps: new Set([...state.completedSteps, action.payload]),
      };

    case "SET_EDITING":
      return {
        ...state,
        isEditing: action.payload,
      };

    case "SET_VALIDATION_ERRORS":
      return {
        ...state,
        validationErrors: action.payload,
      };

    case "CLEAR_VALIDATION_ERRORS":
      return {
        ...state,
        validationErrors: {},
      };

    case "SET_SUBMITTING":
      return {
        ...state,
        isSubmitting: action.payload,
        submitError: action.payload ? null : state.submitError, // Clear error when starting submission
      };

    case "SET_SUBMIT_ERROR":
      return {
        ...state,
        submitError: action.payload,
        isSubmitting: false,
      };

    case "RESET_FORM":
      return {
        ...initialSequenceFormState,
      };

    case "LOAD_SEQUENCE":
      return {
        ...state,
        name: action.payload.name,
        script: action.payload.script,
        selectedStyleId: action.payload.styleId,
        hasUnsavedChanges: false,
        isEditing: true,
        validationErrors: {},
        submitError: null,
      };

    default:
      return state;
  }
}

// Custom hook for using the reducer
export function useSequenceFormReducer(
  initialOverrides?: Partial<SequenceFormState>,
) {
  const initialState = {
    ...initialSequenceFormState,
    ...initialOverrides,
  };

  return useReducer(sequenceFormReducer, initialState);
}

// Validation helpers
export function validateSequenceForm(
  state: SequenceFormState,
): SequenceFormState["validationErrors"] {
  const errors: SequenceFormState["validationErrors"] = {};

  if (!state.name.trim()) {
    errors.name = "Sequence name is required";
  } else if (state.name.length > 100) {
    errors.name = "Name must be 100 characters or less";
  }

  if (!state.script.trim()) {
    errors.script = "Script is required";
  } else if (state.script.length < 10) {
    errors.script = "Script must be at least 10 characters";
  } else if (state.script.length > 10000) {
    errors.script = "Script must be 10,000 characters or less";
  }

  return errors;
}

// Helper to check if form is valid
export function isSequenceFormValid(state: SequenceFormState): boolean {
  const errors = validateSequenceForm(state);
  return Object.keys(errors).length === 0;
}
