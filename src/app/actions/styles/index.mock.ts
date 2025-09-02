"use client";

// Mock implementation for Storybook
import {
  generateMockStyle,
  generateMockStyles,
} from "@/lib/mocks/data-generators";
import type { Style } from "@/types/database";
import type { CreateStyleInput } from "./index";

// Mock data store
let mockStyles: Style[] = generateMockStyles(15);

// Simulate network delay
const simulateDelay = (ms: number = 1000) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function createStyle(input: CreateStyleInput): Promise<Style> {
  await simulateDelay(800);

  const newStyle = generateMockStyle({
    name: input.name,
    config: input.settings,
    is_public: input.is_public,
  });

  mockStyles.push(newStyle);
  return newStyle;
}

export async function updateStyle(
  id: string,
  input: Partial<CreateStyleInput>,
): Promise<Style> {
  await simulateDelay(600);

  const style = mockStyles.find((s) => s.id === id);
  if (!style) {
    throw new Error("Style not found");
  }

  const updated = {
    ...style,
    ...input,
    updated_at: new Date().toISOString(),
  };

  const index = mockStyles.findIndex((s) => s.id === id);
  mockStyles[index] = updated;

  return updated;
}

export async function deleteStyle(id: string): Promise<{ success: boolean }> {
  await simulateDelay(400);

  const index = mockStyles.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new Error("Style not found");
  }

  mockStyles.splice(index, 1);
  return { success: true };
}

export async function getStyle(id: string): Promise<Style> {
  await simulateDelay(300);

  const style = mockStyles.find((s) => s.id === id);
  if (!style) {
    throw new Error("Style not found");
  }

  return style;
}

export async function listStyles(_teamId?: string): Promise<Style[]> {
  await simulateDelay(500);

  return [...mockStyles];
}

// Helper functions
export function getMockStyles() {
  return mockStyles;
}

export function resetMockStyles() {
  mockStyles = generateMockStyles(15);
}
