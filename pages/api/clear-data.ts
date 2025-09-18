import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Mock response para limpar dados
    res.status(200).json({
      success: true,
      message: 'Dados limpos com sucesso'
    })
  } catch (error) {
    console.error('Error in clear-data:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    })
  }
}