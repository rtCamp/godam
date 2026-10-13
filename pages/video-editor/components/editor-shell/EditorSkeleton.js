/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * A single shimmer placeholder block.
 *
 * Shape (height / radius) comes from the `variant` modifier; pass `width`
 * for the few one-off widths (number → px, string used verbatim).
 *
 * @param {Object}        props
 * @param {string}        [props.variant]   Shape modifier, e.g. 'text', 'btn', 'square'.
 * @param {number|string} [props.width]     Optional explicit width.
 * @param {string}        [props.className] Extra class names.
 * @param {Object}        [props.style]     Optional extra inline styles (merged after width).
 * @return {JSX.Element} The placeholder block.
 */
const Block = ( { variant = 'text', width, className = '', style } ) => {
	const inlineStyle = ( width !== undefined || style )
		? { ...( width !== undefined ? { width } : {} ), ...style }
		: undefined;

	return (
		<span
			aria-hidden="true"
			className={ `ve-skeleton ve-skeleton--${ variant } ${ className }`.trim() }
			style={ inlineStyle }
		/>
	);
};

const LAYER_ROWS = [ 0, 1, 2, 3, 4 ];
const STAT_CELLS = [ 0, 1, 2, 3 ];
const RAIL_ICONS = [ 0, 1, 2 ];
const RULER_TICKS = [ 0, 1, 2, 3, 4, 5, 6 ];
// Faux marker chips positioned along the timeline track.
const TIMELINE_CHIPS = [ '18%', '42%', '71%' ];

/**
 * Loading placeholder for the Video Editor.
 *
 * Renders the same 3-zone shell as the live editor (top bar → stats row →
 * rail · layers panel · video stage + timeline · configuration panel) by
 * reusing the real `godam-video-editor__*` layout classes, so the skeleton's
 * proportions track the editor automatically and stay in sync if the shell
 * changes. Shown while the attachment config is loading.
 *
 * @return {JSX.Element} The editor skeleton.
 */
const EditorSkeleton = () => {
	return (
		<div
			className="godam-video-editor godam-video-editor--skeleton"
			role="status"
			aria-busy="true"
			aria-label={ __( 'Loading video editor…', 'godam' ) }
		>
			<span className="screen-reader-text">{ __( 'Loading video editor…', 'godam' ) }</span>

			{ /* Top bar */ }
			<div className="godam-video-editor__topbar">
				<div className="ve-skeleton__topbar-left">
					<Block variant="icon" />
					<div className="ve-skeleton__titles">
						<Block variant="title" width={ 180 } />
						<Block variant="text-sm" width={ 96 } />
					</div>
				</div>
				<div className="ve-skeleton__topbar-actions">
					<Block variant="btn" width={ 72 } />
					<Block variant="btn" width={ 88 } />
					<Block variant="btn" className="ve-skeleton--accent" width={ 116 } />
					<Block variant="icon" />
				</div>
			</div>

			{ /* Stats row */ }
			<div className="godam-video-editor__stats">
				{ STAT_CELLS.map( ( cell ) => (
					<div key={ cell } className="godam-video-editor__stat">
						<Block variant="text-sm" width={ 104 } />
						<Block variant="text" className="ve-skeleton--gap-top" width={ 64 } />
					</div>
				) ) }
			</div>

			{ /* Body: rail · panel · stage · config */ }
			<div className="godam-video-editor__body">
				{ /* Tab rail */ }
				<div className="godam-video-editor__rail">
					{ RAIL_ICONS.map( ( icon ) => (
						<Block key={ icon } variant="square" />
					) ) }
				</div>

				{ /* Layers panel */ }
				<aside className="godam-video-editor__panel">
					<div className="ve-skeleton__panel">
						<div className="ve-skeleton__panel-head">
							<Block variant="title" width={ 92 } />
							<Block variant="btn" width={ 96 } />
						</div>
						<div className="ve-skeleton__rows">
							{ LAYER_ROWS.map( ( row ) => (
								<div key={ row } className="ve-skeleton__row">
									<Block variant="square" className="ve-skeleton--circle" />
									<div className="ve-skeleton__row-lines">
										<Block variant="text" width="70%" />
										<Block variant="text-sm" width="45%" />
									</div>
									<Block variant="icon" width={ 20 } />
								</div>
							) ) }
						</div>
					</div>
				</aside>

				{ /* Video stage */ }
				<main className="godam-video-editor__stage">
					<div className="godam-video-editor__stage-canvas">
						<Block variant="video" />
					</div>

					<div className="godam-video-editor__timeline-dock">
						<div className="ve-skeleton__timeline">
							<div className="ve-skeleton__chips">
								{ TIMELINE_CHIPS.map( ( left ) => (
									<Block
										key={ left }
										variant="pill"
										className="ve-skeleton__chip"
										width={ 28 }
										style={ { left } }
									/>
								) ) }
							</div>
							<Block variant="track" />
							<div className="ve-skeleton__ruler">
								{ RULER_TICKS.map( ( tick ) => (
									<Block key={ tick } variant="text-sm" width={ 28 } />
								) ) }
							</div>
						</div>
					</div>
				</main>

				{ /* Configuration panel */ }
				<aside className="godam-video-editor__config">
					<div className="godam-video-editor__config-header">
						<Block variant="title" width={ 128 } />
						<Block variant="text-sm" className="ve-skeleton--gap-top" width={ 168 } />
					</div>
					<div className="ve-skeleton__config-body">
						{ LAYER_ROWS.slice( 0, 4 ).map( ( field ) => (
							<div key={ field } className="ve-skeleton__field">
								<Block variant="text-sm" width={ 88 } />
								<Block variant="btn" width="100%" />
							</div>
						) ) }
					</div>
				</aside>
			</div>
		</div>
	);
};

export default EditorSkeleton;
