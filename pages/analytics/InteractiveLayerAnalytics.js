/**
 * External dependencies
 */
import { useState } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import SingleLayerAnalyticsList from './SingleLayerAnalyticsList.js';

/**
 * InteractiveLayerAnalytics Component
 *
 * Renders the analytics dashboard section for interactive video layers (CTA, Hotspot, Form).
 * Provides tab-based navigation between layer types and a date range filter to view
 * performance metrics over different time periods.
 *
 * @param {Object}        props              - Component props.
 * @param {number|string} props.attachmentID - The WordPress media attachment ID of the video
 *
 * @return {JSX.Element} A styled container with tabs, date filter, and analytics list.
 */
const InteractiveLayerAnalytics = ( { attachmentID } ) => {
	const [ activeTab, setActiveTab ] = useState( 'CTA' );
	const [ dateRange, setDateRange ] = useState( '7d' );

	return (
		<div className="mx-10 my-6 bg-white border border-zinc-200 rounded-lg">
			<div className="flex justify-between">
				<h3 className="text-base font-semibold m-0 p-6">
					{ __( 'Interactive Layer Performance', 'godam' ) }
				</h3>

				{ /* Tabs & Filter */ }
				<div className="flex items-center justify-between mb-4 gap-6 pr-6">
					<div className="flex space-x-2">
						{ [ 'CTA', 'Hotspot', 'Form' ].map( ( tab ) => (
							<button
								key={ tab }
								onClick={ () => setActiveTab( tab ) }
								className={ `px-4 py-2 rounded-md text-sm font-medium cursor-pointer ${
									activeTab === tab
										? 'bg-[#AB3A6C1A] text-[#AB3A6C] border-none'
										: 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
								}` }
							>
								{ tab }
							</button>
						) ) }
					</div>

					{ /* Date Filter */ }
					<div className="px-3 py-1.5 rounded-md border border-[var(--border,#E4E4E7)]">
						<select
							value={ dateRange }
							onChange={ ( e ) => setDateRange( e.target.value ) }
							className="border-none"
						>
							<option value="7d">{ __( 'Last 7 days', 'godam' ) }</option>
							<option value="30d">{ __( 'Last 30 days', 'godam' ) }</option>
							<option value="60d">{ __( 'Last 60 days', 'godam' ) }</option>
							<option value="1y">{ __( 'Last Year', 'godam' ) }</option>
						</select>
					</div>
				</div>
			</div>

			<SingleLayerAnalyticsList
				activeTab={ activeTab }
				dateRange={ dateRange }
				attachmentID={ attachmentID }
			/>
		</div>
	);
};

export default InteractiveLayerAnalytics;
