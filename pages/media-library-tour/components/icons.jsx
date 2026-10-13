/**
 * Icons + artwork for the Media Library guided tour.
 */

/**
 * Light-bulb icon for the "Take a tour" button.
 *
 * @return {JSX.Element} SVG icon.
 */
export const BulbIcon = () => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
		<path d="M9 18h6M10 21h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
		<path d="M12 3a6 6 0 0 0-3.6 10.8c.7.53 1.1 1.2 1.1 1.95V16h5v-.25c0-.75.4-1.42 1.1-1.95A6 6 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
		<path d="M12 7.2a2.8 2.8 0 0 0-2.8 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
	</svg>
);

/**
 * Welcome-modal illustration: a stylised Media Library with a folder sidebar,
 * a nested folder being created and a media tile being dragged into it.
 * Pure SVG so it ships inside the bundle with no image request.
 *
 * @return {JSX.Element} SVG illustration.
 */
export const WelcomeIllustration = () => (
	<svg viewBox="0 0 560 240" role="img" aria-hidden="true" focusable="false" className="godam-ml-tour-welcome__art">
		<defs>
			<linearGradient id="godamMlTourBg" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stopColor="#241655" />
				<stop offset="1" stopColor="#4a1d96" />
			</linearGradient>
		</defs>
		<rect width="560" height="240" rx="12" fill="url(#godamMlTourBg)" />
		{ /* Window */ }
		<rect x="36" y="28" width="488" height="190" rx="10" fill="#fff" />
		<rect x="36" y="28" width="488" height="24" rx="10" fill="#f0f0f5" />
		<circle cx="52" cy="40" r="4" fill="#ff6b6b" />
		<circle cx="66" cy="40" r="4" fill="#ffc94d" />
		<circle cx="80" cy="40" r="4" fill="#4cd98a" />
		{ /* Sidebar */ }
		<rect x="36" y="52" width="150" height="166" fill="#f7f6fd" />
		<rect x="50" y="64" width="122" height="20" rx="5" fill="#3858e9" />
		<rect x="62" y="71" width="60" height="6" rx="3" fill="#fff" />
		{ [ 0, 1, 2, 3 ].map( ( i ) => (
			<g key={ i } transform={ `translate(${ i === 2 ? 64 : 50 } ${ 96 + ( i * 26 ) })` }>
				<rect width={ i === 2 ? 108 : 122 } height="20" rx="5" fill={ i === 1 ? '#e7e2ff' : '#fff' } stroke={ i === 1 ? '#7c4dff' : '#e4e4ee' } />
				<path d="M8 6h6l2 2h8v7H8z" fill={ i === 1 ? '#7c4dff' : '#b6b3c9' } />
				<rect x="30" y="8" width={ i === 2 ? 40 : 56 } height="5" rx="2.5" fill={ i === 1 ? '#4a1d96' : '#c9c7d6' } />
			</g>
		) ) }
		{ /* Grid */ }
		{ [ 0, 1, 2, 3, 4, 5, 6, 7 ].map( ( i ) => (
			<rect
				key={ i }
				x={ 206 + ( ( i % 4 ) * 78 ) }
				y={ 66 + ( Math.floor( i / 4 ) * 74 ) }
				width="66"
				height="62"
				rx="6"
				fill={ [ '#ffd6e0', '#d6e4ff', '#e0f5e9', '#fff1cc', '#e7e2ff', '#ffe3d1', '#d9f2ff', '#f0f0f5' ][ i ] }
			/>
		) ) }
		{ /* Dragged tile heading to the highlighted folder */ }
		<path d="M236 104 C 210 118, 196 120, 178 124" stroke="#7c4dff" strokeWidth="2" strokeDasharray="5 5" fill="none" />
		<g transform="translate(150 112) rotate(-8)">
			<rect width="44" height="38" rx="6" fill="#d6e4ff" stroke="#7c4dff" strokeWidth="2" />
			<circle cx="14" cy="13" r="5" fill="#7c4dff" />
			<path d="M6 32l11-11 8 8 5-5 8 8z" fill="#3858e9" />
		</g>
		{ /* Sparkle */ }
		<path d="M500 70l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#ffc94d" />
	</svg>
);
