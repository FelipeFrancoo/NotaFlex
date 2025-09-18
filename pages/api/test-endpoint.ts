import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('Test endpoint called')
    console.log('Method:', req.method)
    console.log('Body:', req.body)
    
    res.status(200).json({ 
      success: true, 
      message: 'Endpoint funcionando',
      method: req.method,
      body: req.body
    })
  } catch (error) {
    console.error('Error in test endpoint:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Erro: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
    })
  }
}