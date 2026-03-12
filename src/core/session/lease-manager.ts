/**
 * Lease Manager for Background Commands
 *
 * This module provides lease-based lifecycle management for background commands.
 * Commands are automatically cleaned up when their leases expire.
 */

interface Lease {
  id: string;
  commandId: string;
  expiresAt: number;
}

interface LeaseManagerConfig {
  renewalInterval: number; // ms
  expiry: number; // ms
}

const DEFAULT_CONFIG: LeaseManagerConfig = {
  renewalInterval: parseInt(
    process.env["OPENSDK_LEASE_RENEWAL_INTERVAL"] || "5000",
    10,
  ),
  expiry: parseInt(process.env["OPENSDK_LEASE_EXPIRY"] || "15000", 10),
};

export class LeaseManager {
  private leases: Map<string, Lease> = new Map();
  private renewTimer: NodeJS.Timeout | null = null;
  private readonly config: LeaseManagerConfig;
  private onLeaseExpired?: (leaseId: string) => void;

  constructor(
    config: Partial<LeaseManagerConfig> = {},
    onLeaseExpired?: (leaseId: string) => void,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onLeaseExpired = onLeaseExpired;
  }

  /**
   * Create a new lease for a command
   */
  createLease(commandId: string): string {
    const leaseId = `lease_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const lease: Lease = {
      id: leaseId,
      commandId,
      expiresAt: Date.now() + this.config.expiry,
    };
    this.leases.set(leaseId, lease);
    return leaseId;
  }

  /**
   * Renew a lease
   */
  renewLease(leaseId: string): boolean {
    const lease = this.leases.get(leaseId);
    if (!lease) return false;
    lease.expiresAt = Date.now() + this.config.expiry;
    return true;
  }

  /**
   * Start automatic renewal
   */
  startRenewal(): void {
    if (this.renewTimer) return;

    this.renewTimer = setInterval(() => {
      this.renewAll();
    }, this.config.renewalInterval);
  }

  /**
   * Stop automatic renewal
   */
  stop(): void {
    if (this.renewTimer) {
      clearInterval(this.renewTimer);
      this.renewTimer = null;
    }
  }

  /**
   * Renew all active leases
   */
  private renewAll(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [leaseId, lease] of this.leases.entries()) {
      if (lease.expiresAt <= now) {
        expired.push(leaseId);
      } else {
        lease.expiresAt = now + this.config.expiry;
      }
    }

    // Notify about expired leases
    for (const leaseId of expired) {
      this.leases.delete(leaseId);
      if (this.onLeaseExpired) {
        this.onLeaseExpired(leaseId);
      }
    }
  }

  /**
   * Get expired leases
   */
  getExpiredLeases(): string[] {
    const now = Date.now();
    const expired: string[] = [];

    for (const [leaseId, lease] of this.leases.entries()) {
      if (lease.expiresAt <= now) {
        expired.push(leaseId);
      }
    }

    return expired;
  }

  /**
   * Delete a lease
   */
  deleteLease(leaseId: string): boolean {
    return this.leases.delete(leaseId);
  }

  /**
   * Get lease by ID
   */
  getLease(leaseId: string): Lease | undefined {
    return this.leases.get(leaseId);
  }

  /**
   * Get lease by command ID
   */
  getLeaseByCommandId(commandId: string): Lease | undefined {
    for (const lease of this.leases.values()) {
      if (lease.commandId === commandId) {
        return lease;
      }
    }
    return undefined;
  }

  /**
   * Get all leases
   */
  getAllLeases(): Lease[] {
    return Array.from(this.leases.values());
  }

  /**
   * Clear all leases
   */
  clear(): void {
    this.leases.clear();
  }
}
