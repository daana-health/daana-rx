import { NextRequest, NextResponse } from 'next/server';
import { drugApiService } from '../../../../server/services/drugApiService';

/**
 * API Route: Search drugs from external APIs
 * GET /api/drugs/search?q=query&limit=10
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required and must be at least 2 characters' },
        { status: 400 }
      );
    }

    const results = await drugApiService.searchDrugs(query.trim(), limit);

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('Drug search API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to search drugs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

