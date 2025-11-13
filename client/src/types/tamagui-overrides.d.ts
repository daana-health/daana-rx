/**
 * TypeScript declaration overrides for Tamagui components
 * These extend Tamagui's type definitions to support HTML attributes
 */

import 'tamagui';
import { YStackProps, XStackProps, InputProps, ButtonProps } from 'tamagui';

declare module 'tamagui' {
  interface YStackProps {
    /**
     * HTML form onSubmit handler
     * Note: Use with tag="form" prop
     */
    onSubmit?: (e: React.FormEvent) => void;
    /**
     * CSS order property for flexbox
     */
    order?: number;
  }

  interface XStackProps {
    /**
     * HTML form onSubmit handler
     * Note: Use with tag="form" prop
     */
    onSubmit?: (e: React.FormEvent) => void;
    /**
     * CSS order property for flexbox
     */
    order?: number;
  }

  interface InputProps {
    /**
     * HTML required attribute
     */
    required?: boolean;
    /**
     * HTML min attribute (for number inputs)
     */
    min?: number;
    /**
     * HTML max attribute (for number inputs)
     */
    max?: number;
  }

  interface ButtonProps {
    /**
     * HTML button type attribute
     */
    type?: 'button' | 'submit' | 'reset';
    /**
     * Text decoration CSS property
     */
    textDecorationLine?: string;
  }

  interface TextProps {
    /**
     * CSS order property for flexbox
     */
    order?: number;
  }

  interface H2Props {
    /**
     * CSS order property for flexbox
     */
    order?: number;
  }
}

