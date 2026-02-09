/**
 * Email Templates - Type Definitions
 */

export interface TemplateDefinition {
  /** Postmark template alias */
  alias: string;
  
  /** Human-readable template name */
  displayName: string;
  
  /** Template description */
  description: string;
  
  /** Required template variables */
  requiredData: string[];
  
  /** Locale (UK English for MVP) */
  locale: 'en-GB';
}
