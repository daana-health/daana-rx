import { NextRequest, NextResponse } from 'next/server';
import { drugApiService } from '../../../../server/services/drugApiService';

/**
 * API Route: Get drug by NDC code
 * GET /api/drugs/ndc?code=12345678901
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ndc = searchParams.get('code');

    if (!ndc) {
      return NextResponse.json(
        { error: 'Query parameter "code" is required' },
        { status: 400 }
      );
    }

    const result = await drugApiService.getDrugByNDC(ndc);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Drug not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('NDC lookup API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to lookup drug by NDC',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

