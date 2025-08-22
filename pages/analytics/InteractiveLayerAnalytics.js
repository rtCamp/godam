/**
 * External dependencies
 */
import { useEffect, useState } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { layerAnalyticsBarChart } from './helper.js';

const InteractiveLayerAnalytics = () => {
	const [ activeTab, setActiveTab ] = useState( 'CTA' );
	const [ dateRange, setDateRange ] = useState( 'Last 7 days' );

	// CTA data array
	const ctaData = [
		{
			title: 'Sign Up Free Trial',
			position: '2:30',
			clicks: 567,
			skips: 57,
			clickRate: 85,
		},
		{
			title: '',
			position: '1:55',
			clicks: 422,
			skips: 128,
			clickRate: 78,
		},
		{
			title: 'Book Demo',
			position: '0:45',
			clicks: 298,
			skips: 12,
			clickRate: 68,
		},
		{
			title: 'Download Whitepaper',
			position: '1:10',
			clicks: 432,
			skips: 68,
			clickRate: 64,
		},
	];

	// Utility function for colors
	const getClickRateColor = ( rate ) => {
		if ( rate < 65 ) {
			return 'text-red-600';
		}
		if ( rate >= 65 && rate <= 75 ) {
			return 'text-yellow-500';
		}
		return 'text-green-600';
	};

	const dummyChartData = [
		{ label: 'Mon', clicks: 68, hovers: 88 },
		{ label: 'Tue', clicks: 60, hovers: 104 },
		{ label: 'Wed', clicks: 114, hovers: 76 },
		{ label: 'Thu', clicks: 74, hovers: 76 },
		{ label: 'Fri', clicks: 68, hovers: 90 },
		{ label: 'Sat', clicks: 82, hovers: 76 },
		{ label: 'Sun', clicks: 48, hovers: 66 },
	];
	const generate60DaysData = () => {
		const data = [];
		const today = new Date();
		for ( let i = 59; i >= 0; i-- ) {
			const date = new Date( today );
			date.setDate( today.getDate() - i );
			const label = date.toISOString().slice( 0, 10 ); // YYYY-MM-DD format

			// Random sample values for clicks and hovers - adjust ranges as needed
			const clicks = Math.floor( Math.random() * 120 ) + 10; // 10 to 130
			const hovers = Math.floor( Math.random() * 140 ) + 20; // 20 to 160

			data.push( {
				label,
				clicks,
				hovers,
			} );
		}
		return data;
	};

	const generate1YearData = () => {
		const data = [];
		const today = new Date();
		for ( let i = 364; i >= 0; i-- ) {
			const date = new Date( today );
			date.setDate( today.getDate() - i );
			const label = date.toISOString().slice( 0, 10 ); // YYYY-MM-DD format

			// Random sample values for clicks and hovers - adjust ranges as needed
			const clicks = Math.floor( Math.random() * 150 ) + 20; // 20 to 170
			const hovers = Math.floor( Math.random() * 160 ) + 30; // 30 to 190

			data.push( {
				label,
				clicks,
				hovers,
			} );
		}
		return data;
	};

	// Usage example:
	// const dummyChartData = generate1YearData();

	// Usage
	// const dummyChartData = generate60DaysData();

	useEffect( () => {
		layerAnalyticsBarChart( dummyChartData, '#layer-analytics-graph', '7d' );
	}, [] );

	// className = "grid grid-cols-[2fr_2fr_1fr] gap-4 px-10 metrics-container";
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
							<option>Last 7 days</option>
							<option>Last 30 days</option>
							<option>Last 60 days</option>
							<option>Last Year</option>
						</select>
					</div>
				</div>
			</div>
			{/* 2fr 3fr 2fr; */}
			{ /* Analytics Block */ }
			<div className="grid grid-cols-[3fr_3fr_2fr] h-[350px]">
				<div className="overflow-auto">
					<div className="divide-y px-6">
						{ ctaData.map( ( item, index ) => (
							<div key={ index } className="flex justify-between items-center">
								<div>
									<p className="text-sm font-medium text-zinc-800">
										{ item.title.length > 0 ? item.title : `${ activeTab } Layer` }
									</p>
									<p className="text-sm text-zinc-500">
										Position:{ ' ' }
										<span className="font-medium text-black">
											{ item.position }
										</span>{ ' ' }
										• Clicks:{ ' ' }
										<span className="font-medium text-black">
											{ item.clicks }
										</span>{ ' ' }
										• Skips:{ ' ' }
										<span className="font-medium text-black">{ item.skips }</span>
									</p>
								</div>
								<div className="text-right">
									<p
										className={ `text-lg font-semibold ${ getClickRateColor( item.clickRate ) } my-3` }
									>
										{ item.clickRate }%
									</p>
									<p className="text-xs text-zinc-400">Click Rate</p>
								</div>
							</div>
						) ) }
					</div>
				</div>

				<div className="overflow-auto" id="layer-analytics-graph"></div>

				<div className="grid grid-cols-2 gap-4 px-6 pb-6 overflow-auto">
					{ /* Top card spans both columns */ }
					<div className="col-span-2 rounded-2xl p-6 bg-zinc-50 flex flex-col items-center justify-center">
						<p className="text-3xl font-bold text-green-600">85%</p>
						<p className="text-sm text-zinc-500 mt-1">Avg. Click Rate</p>
					</div>

					{ /* Bottom-left */ }
					<div className="rounded-2xl p-6 bg-green-50 flex flex-col items-center justify-center">
						<p className="text-2xl font-bold text-green-600">230</p>
						<p className="text-sm text-zinc-500 mt-1">Total Clicks</p>
					</div>

					{ /* Bottom-right */ }
					<div className="rounded-2xl p-6 bg-red-50 flex flex-col items-center justify-center">
						<p className="text-2xl font-bold text-red-600">230</p>
						<p className="text-sm text-zinc-500 mt-1">Total Skips</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default InteractiveLayerAnalytics;
