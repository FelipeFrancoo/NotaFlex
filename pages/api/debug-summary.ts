import { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../lib/storage';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const summary = (storage as any)['summaryData'];
  res.status(200).json({
    hasSummary: !!summary,
    keys: (storage as any).keys(),
    branchCount: summary?.branches?.length || 0,
    dateTotals: summary?.dateSpecificTotals?.length || 0,
    preview: summary ? {
      branches: summary.branches.slice(0, 3),
      dateSpecificTotals: summary.dateSpecificTotals.slice(0, 3)
    } : null
  });
}