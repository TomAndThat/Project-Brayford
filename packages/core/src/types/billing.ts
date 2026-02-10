/**
 * Billing Types
 * 
 * Type definitions for organization billing tiers and email domain enforcement.
 * Part of the subscription sharing prevention system.
 */

/**
 * Billing tier determines pricing model and domain requirements
 * 
 * - per_brand: Pay per brand created (for free email domains)
 * - flat_rate: Monthly flat fee with generous brand allowance (for corporate domains)
 */
export type BillingTier = 'per_brand' | 'flat_rate';

/**
 * Information about an organization's billing tier
 */
export interface BillingTierInfo {
  /**
   * The billing tier
   */
  tier: BillingTier;
  
  /**
   * Maximum number of brands allowed
   * - undefined/null = unlimited (typical for flat_rate)
   * - number = hard limit (enforced for per_brand tier)
   */
  brandLimit?: number | null;
  
  /**
   * Whether domain matching is enforced for invitations
   * Only applicable when tier is flat_rate
   */
  requiresDomainMatch: boolean;
  
  /**
   * Allowed email domains for this organization
   * Empty array means no domain restrictions
   */
  allowedDomains: string[];
  
  /**
   * Primary domain detected from organization creator's email
   */
  primaryDomain: string;
}

/**
 * Domain verification status for corporate accounts
 * Future feature: Verify domain ownership via DNS records
 */
export interface DomainVerificationStatus {
  /**
   * Whether domain ownership has been verified
   */
  verified: boolean;
  
  /**
   * When verification was completed (null if not verified)
   */
  verifiedAt: Date | null;
  
  /**
   * Method used for verification (future: 'dns_txt', 'email', etc.)
   */
  verificationMethod?: string;
}
