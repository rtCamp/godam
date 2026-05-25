/**
 * Reel Pops cumulative table for the GoDAM Dashboard.
 *
 * Fetches /godam/v1/dashboard/reel-pops-summary once on mount and renders one
 * row per Reel Pop with the four cumulative counters (Impressions, Engagement,
 * Closure, Conversion). Each row links to the Reel Pop editor.
 *
 * Counters are unique page-load sessions (uniqExact(page_load_session_id) on
 * the microservice), so derived rates are bounded ≤ 100%.
 *
 * @package GoDAM
 */

import React, { useEffect, useState } from 'react';

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { formatNumber } from '../../utils/formatters';
import chevronLeft from '../../../assets/src/images/chevron-left.svg';
import chevronRight from '../../../assets/src/images/chevron-right.svg';
import DefaultThumbnail from '../../../assets/src/images/video-thumbnail-default.png';

const PAGE_SIZE = 10;

const ReelPopsTable = () => {
	const [ rows, setRows ] = useState( null );
	const [ error, setError ] = useState( null );
	const [ page, setPage ] = useState( 1 );

	useEffect( () => {
		apiFetch( { path: '/godam/v1/dashboard/reel-pops-summary' } )
			.then( ( data ) => setRows( Array.isArray( data?.reel_pops ) ? data.reel_pops : [] ) )
			.catch( ( err ) => setError( err?.message || __( 'Failed to load Reel Pops summary.', 'godam' ) ) );
	}, [] );

	if ( error ) {
		return (
			<div className="top-media-container godam-reel-pops-table godam-reel-pops-table--error">
				<div className="flex justify-between pt-4">
					<h2>{ __( 'Reel Pops', 'godam' ) }</h2>
				</div>
				<p>{ error }</p>
			</div>
		);
	}

	if ( null === rows ) {
		return (
			<div className="top-media-container godam-reel-pops-table godam-reel-pops-table--loading">
				<div className="flex justify-between pt-4">
					<h2>{ __( 'Reel Pops', 'godam' ) }</h2>
				</div>
				<div className="table-container overflow-x-auto">
					<div className="space-y-4 mt-3">
						<div className="skeleton h-4 w-full"></div>
						<div className="skeleton h-4 w-full"></div>
						<div className="skeleton h-4 w-full"></div>
					</div>
				</div>
			</div>
		);
	}

	if ( rows.length === 0 ) {
		return (
			<div className="top-media-container godam-reel-pops-table godam-reel-pops-table--empty">
				<div className="flex justify-between pt-4">
					<h2>{ __( 'Reel Pops', 'godam' ) }</h2>
				</div>
				<div className="table-container overflow-x-auto">
					<p className="text-center py-4 text-lg">
						{ __( 'No Reel Pops yet.', 'godam' ) }
					</p>
				</div>
			</div>
		);
	}

	const totalPages = Math.max( 1, Math.ceil( rows.length / PAGE_SIZE ) );
	const safePage = Math.min( page, totalPages );
	const start = ( safePage - 1 ) * PAGE_SIZE;
	const visible = rows.slice( start, start + PAGE_SIZE );

	return (
		<div className="top-media-container godam-reel-pops-table">
			<div className="flex justify-between pt-4">
				<h2>{ __( 'Reel Pops', 'godam' ) }</h2>
			</div>
			<div className="table-container overflow-x-auto">
				<table className="w-full">
					<tbody>
						<tr>
							<th>{ __( 'Reel Pop', 'godam' ) }</th>
							<th>{ __( 'Impressions', 'godam' ) }</th>
							<th>{ __( 'Engagement', 'godam' ) }</th>
							<th>{ __( 'Closure', 'godam' ) }</th>
							<th>{ __( 'Conversion', 'godam' ) }</th>
						</tr>
						{ visible.map( ( row ) => (
							<tr key={ row.reel_pop_id }>
								<td>
									<div className="video-info">
										<a className="thumbnail-link" href={ row.edit_url }>
											<img
												src={ row.thumbnail || DefaultThumbnail }
												alt={ row.title || __( 'Reel Pop thumbnail', 'godam' ) }
											/>
										</a>
										<a className="title-link" href={ row.edit_url }>
											<div className="w-full max-w-40 text-left flex-1">
												<p className="font-semibold">
													{ row.title || sprintf(
														/* translators: %s is the Reel Pop ID. */
														__( 'Reel Pop #%s', 'godam' ),
														row.reel_pop_id,
													) }
												</p>
											</div>
										</a>
									</div>
								</td>
								<td title={ ( row.impressions ?? 0 ).toLocaleString() }>
									{ formatNumber( row.impressions ?? 0 ) }
								</td>
								<td title={ ( row.engagement ?? 0 ).toLocaleString() }>
									{ formatNumber( row.engagement ?? 0 ) }
								</td>
								<td title={ ( row.closure ?? 0 ).toLocaleString() }>
									{ formatNumber( row.closure ?? 0 ) }
								</td>
								<td title={ ( row.conversion ?? 0 ).toLocaleString() }>
									{ formatNumber( row.conversion ?? 0 ) }
								</td>
							</tr>
						) ) }
					</tbody>
				</table>
			</div>
			{ totalPages > 1 && (
				<div className="flex items-center justify-between mt-4">
					<p className="text-sm text-gray-500">
						{
							/* translators: %1$d is the current page number, %2$d is the total number of pages */
							sprintf( __( 'Page %1$d of %2$d', 'godam' ), safePage, totalPages )
						}
					</p>
					<div className="flex items-center gap-4">
						<button
							className="previous-btn flex items-center gap-1"
							disabled={ safePage === 1 }
							onClick={ () => setPage( ( prev ) => Math.max( prev - 1, 1 ) ) }
						>
							<img
								src={ chevronLeft }
								alt={ __( 'Previous', 'godam' ) }
								className={ `w-4 h-4 chevron-icon ${ safePage === 1 ? 'icon-disabled' : '' }` }
							/>
							<span>{ __( 'Previous', 'godam' ) }</span>
						</button>
						<button
							className="next-btn flex items-center gap-1"
							disabled={ safePage >= totalPages }
							onClick={ () => setPage( ( prev ) => prev + 1 ) }
						>
							<span>{ __( 'Next', 'godam' ) }</span>
							<img
								src={ chevronRight }
								alt={ __( 'Next', 'godam' ) }
								className={ `w-4 h-4 chevron-icon ${ safePage >= totalPages ? 'icon-disabled' : '' }` }
							/>
						</button>
					</div>
				</div>
			) }
		</div>
	);
};

export default ReelPopsTable;
