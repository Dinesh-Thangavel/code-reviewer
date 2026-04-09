/**
 * Export Button Component
 * Handles CSV/PDF exports
 */

import { Button } from '@/components/ui/button'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface ExportButtonProps {
  type: 'insights' | 'dashboard' | 'pr-reviews' | 'audit'
  className?: string
}

export function ExportButton({ type, className }: ExportButtonProps) {
  const { toast } = useToast()

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      let endpoint = '';
      let filename = '';

      switch (type) {
        case 'insights':
          endpoint = format === 'csv' ? '/export/insights/csv' : '/export/insights/pdf';
          filename = format === 'csv' ? 'insights.csv' : 'insights-report.html';
          break;
        case 'dashboard':
          endpoint = format === 'csv' ? '/export/dashboard/csv' : '/export/dashboard/pdf';
          filename = format === 'csv' ? 'dashboard-stats.csv' : 'dashboard-report.html';
          break;
        case 'pr-reviews':
          endpoint = '/export/pr-reviews/csv';
          filename = 'pr-reviews.csv';
          break;
        case 'audit':
          endpoint = format === 'csv' ? '/export/audit/csv' : '/export/audit/pdf';
          filename = format === 'csv' ? 'audit-logs.csv' : 'audit-report.html';
          break;
      }

      const response = await api.get(endpoint, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error?.response?.data?.error || 'Failed to export. Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-2xl">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        {type !== 'pr-reviews' && (
          <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="mr-2 h-4 w-4" />
          Export as PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
