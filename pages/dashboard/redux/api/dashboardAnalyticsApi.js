/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

/**
 * Build the optional date-range query params. Only includes `start_date` /
 * `end_date` when set, so all-time requests keep their existing shape (and
 * cache key). Dates are ISO `YYYY-MM-DD` strings; `null`/`undefined` = all-time.
 *
 * @param {Object} range             Selected range.
 * @param {string} [range.startDate] ISO start date.
 * @param {string} [range.endDate]   ISO end date.
 * @return {Object} Params object with start_date/end_date when present.
 */
const rangeParams = ( { startDate, endDate } = {} ) => ( {
	...( startDate ? { start_date: startDate } : {} ),
	...( endDate ? { end_date: endDate } : {} ),
} );

export const dashboardAnalyticsApi = createApi( {
	reducerPath: 'dashboardAnalyticsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'Content-Type', 'application/json' );
			headers.set( 'X-WP-Nonce', window.wpApiSettings.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		// Fetch Dashboard Metrics (all-time by default; range-scoped when
		// startDate/endDate are supplied).
		fetchDashboardMetrics: builder.query( {
			query: ( { siteUrl, startDate, endDate } ) => ( {
				url: 'godam/v1/analytics/dashboard-metrics',
				params: {
					site_url: siteUrl,
					...rangeParams( { startDate, endDate } ),
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					return {
						errorType: response.errorType || 'unknown_error',
						message: response.message || 'An unknown error occurred.',
					};
				}

				return response.dashboard_metrics || {};
			},
		} ),
		// Per-placement funnel (the "Funnel by placement" card). Fetched
		// separately from the main metrics so its heavier per-placement queries
		// don't block the dashboard load.
		fetchPlacementFunnels: builder.query( {
			query: ( { siteUrl, startDate, endDate } ) => ( {
				url: 'godam/v1/analytics/placement-funnels',
				params: {
					site_url: siteUrl,
					...rangeParams( { startDate, endDate } ),
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					return { error: true, message: response.message };
				}
				return response.placement_funnels || [];
			},
		} ),
		// Fetch Dashboard Metrics History
		fetchDashboardMetricsHistory: builder.query( {
			query: ( { siteUrl, days, startDate, endDate } ) => ( {
				url: 'godam/v1/analytics/dashboard-history',
				params: {
					site_url: siteUrl,
					// Explicit range wins over `days` (the microservice enforces
					// the same precedence); only send `days` when no range is set.
					// Guarded on a real value so an undefined `days` never
					// serializes to `days=undefined` and trips proxy validation.
					...( ! startDate && ! endDate && days !== undefined ? { days } : {} ),
					...rangeParams( { startDate, endDate } ),
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					throw new Error( response.message );
				}
				return response.dashboard_metrics_history || [];
			},
		} ),
		// Fetch Top Videos
		fetchTopVideos: builder.query( {
			query: ( { siteUrl, page = 1, limit = 10, search = '', hideDeleted = true, startDate, endDate } ) => ( {
				url: 'godam/v1/analytics/top-videos',
				params: {
					site_url: siteUrl,
					page,
					limit,
					hide_deleted: hideDeleted ? 1 : 0,
					// Only send `search` when set so the proxy can skip the WP_Query.
					...( search ? { search } : {} ),
					...rangeParams( { startDate, endDate } ),
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					throw new Error( response.message );
				}
				return {
					videos: response.top_videos || [],
					totalPages: response.total_pages || 1,
					totalItems: response.total_items || 0,
				};
			},
		} ),
		// Fetch Top Products
		fetchTopProducts: builder.query( {
			// sortBy/order are accepted by the endpoint and reserved for a later
			// interactive column-sort feature; the table sends only the default
			// (product_views, desc) for now.
			query: ( { siteUrl, page = 1, limit = 10, search = '', sortBy = 'product_views', order = 'desc', startDate, endDate } ) => ( {
				url: 'godam/v1/analytics/top-products',
				params: {
					site_url: siteUrl,
					page,
					limit,
					sort_by: sortBy,
					order,
					// Only send `search` when set so the proxy can skip the WP_Query.
					...( search ? { search } : {} ),
					...rangeParams( { startDate, endDate } ),
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					throw new Error( response.message );
				}
				return {
					products: response.top_products || [],
					totalPages: response.total_pages || 1,
					totalItems: response.total_items || 0,
				};
			},
		} ),
		// Fetch GA4 add_to_cart/purchase counts pushed by the godam-for-woo add-on's
		// dataLayer emission. Lives under that add-on's own REST namespace (not
		// `godam/v1`) since it owns the counting; this plugin only surfaces it. Only
		// meaningful (and only called) once `enable_gtm_tracking` is on — see
		// GA4ConnectionWidget.
		//
		// `source_active`/`source_type` report whether another GA4 integration on
		// the store is already covering these events, in which case GoDAM stands
		// down and pushes nothing even though the counters below keep incrementing
		// (they document events "prepared to send", not delivered).
		fetchGa4Counts: builder.query( {
			query: () => ( {
				url: 'godam-for-woo/v1/ga4-counts',
			} ),
			transformResponse: ( response ) => ( {
				addToCartCount: Number( response?.add_to_cart_count || 0 ),
				purchaseCount: Number( response?.purchase_count || 0 ),
				sourceActive: !! response?.source_active,
				sourceType: response?.source_type || '',
			} ),
		} ),
	} ),
} );

export const {
	useFetchDashboardMetricsQuery,
	useFetchDashboardMetricsHistoryQuery,
	useFetchTopVideosQuery,
	useLazyFetchTopVideosQuery,
	useFetchTopProductsQuery,
	useLazyFetchTopProductsQuery,
	useFetchGa4CountsQuery,
	useFetchPlacementFunnelsQuery,
} = dashboardAnalyticsApi;
