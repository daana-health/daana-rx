import { NextRequest, NextResponse } from 'next/server';
import { drugApiService } from '../../../../server/services/drugApiService';

/**
 * API Route: Get related medications
 * GET /api/drugs/related?drug=medication-name
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const drugName = searchParams.get('drug');

    if (!drugName || drugName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query parameter "drug" is required and must be at least 2 characters' },
        { status: 400 }
      );
    }

    const related = await drugApiService.getRelatedMedications(drugName.trim());

    return NextResponse.json({
      success: true,
      related,
      count: related.length,
    });
  } catch (error) {
    console.error('Related medications API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get related medications',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

