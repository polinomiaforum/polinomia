/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: import('~/db/schema').User;
    sessionId?: string;
    isAdmin?: boolean;
    suspended?: boolean;
    canReport?: boolean;
    awaitingReformulation?: { id: number; threadId: number; dueAt: Date | null }[];
  }
}
