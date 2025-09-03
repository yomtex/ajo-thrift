import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getInitials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

export function calculateDaysUntil(date: string | Date): number {
  const targetDate = new Date(date);
  const today = new Date();
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'approved':
    case 'paid':
    case 'active':
    case 'completed':
      return 'success';
    case 'pending':
    case 'recruiting':
      return 'warning';
    case 'rejected':
    case 'missed':
    case 'cancelled':
      return 'destructive';
    case 'late':
      return 'destructive';
    default:
      return 'secondary';
  }
}

export function generateRandomOrder(length: number): number[] {
  const array = Array.from({ length }, (_, i) => i + 1);
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function formatNumberInput(value: string): string {
  // Remove all non-digit characters
  const numericValue = value.replace(/\D/g, '');
  
  // Format with commas
  return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function parseNumberInput(value: string): number {
  // Remove commas and parse as number
  return parseFloat(value.replace(/,/g, '')) || 0;
}