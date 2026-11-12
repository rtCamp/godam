/**
 * "Get your first video live" checklist.
 *
 * Shown on the GoDAM Dashboard instead of zeroed metrics while the analytics
 * service has no data for the site (the dashboard-metrics proxy returns
 * `no_data`). The server says which steps are done (godam/v1/dashboard/setup-checklist);
 * this component only labels them and links each one to where it is done.
 * The first play brings the normal dashboard back.
 *
 * @since n.e.x.t
 */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useFetchSetupChecklistQuery } from '../redux/api/dashboardAnalyticsApi';

const SUPPORT_URL = 'https://app.godam.io/helpdesk/my-tickets';
const BLOCK_DOCS_URL = 'https://godam.io/docs/wordpress/gutenberg-blocks/';

/**
 * Label and action for one step.
 *
 * @since n.e.x.t
 *
 * @param {Object} step         Step from the checklist route.
 * @param {string} step.id      Step id.
 * @param {number} [step.count] Videos left to move, for 'move_videos'.
 * @return {{label: string, action: ?{text: string, href: string, external?: boolean}}} What to show.
 */
export const describeStep = ( { id, count = 0 } ) => {
	switch ( id ) {
		case 'connect_site':
			return { label: __( 'Connect this site', 'godam' ), action: null };
		case 'move_videos':
			if ( count > 0 ) {
				return {
					label: sprintf(
						/* translators: %d: number of Media Library videos not yet on GoDAM. */
						__( 'Move your existing videos to GoDAM: %d found in the Media Library', 'godam' ),
						count,
					),
					action: {
						text: sprintf(
							/* translators: %d: number of videos to move. */
							_n( 'Move %d video', 'Move %d videos', count, 'godam' ),
							count,
						),
						href: 'admin.php?page=rtgodam_tools#retranscode-media',
					},
				};
			}
			return { label: __( 'Move your existing videos to GoDAM', 'godam' ), action: null };
		case 'vimeo':
			return {
				label: __( 'Bring videos over from Vimeo', 'godam' ),
				action: { text: __( 'Connect Vimeo', 'godam' ), href: 'admin.php?page=rtgodam_tools#video-migration' },
			};
		case 'upload_video':
			return {
				label: __( 'Upload a new video', 'godam' ),
				action: { text: __( 'Upload video', 'godam' ), href: 'media-new.php' },
			};
		case 'add_block':
			return {
				label: __( 'Add the GoDAM Video block to a page or lesson', 'godam' ),
				action: { text: __( 'Show me how', 'godam' ), href: BLOCK_DOCS_URL, external: true },
			};
		default:
			return { label: id, action: null };
	}
};

/**
 * Storage used against the plan's total, in GB, from the localized user data.
 *
 * @since n.e.x.t
 *
 * @return {JSX.Element|null} The Storage card, or null when the plan has no quota.
 */
const StorageCard = () => {
	const used = Number( window.userData?.storageUsed ) || 0;
	const total = Number( window.userData?.totalStorage ) || 0;

	if ( total <= 0 ) {
		return null;
	}

	const percent = Math.min( 100, Math.round( ( used / total ) * 100 ) );

	return (
		<div className="godam-card godam-setup-side-card" data-test-id="godam-setup-storage">
			<div className="godam-card__head">
				<h2>{ __( 'Storage', 'godam' ) }</h2>
			</div>
			<div
				className="godam-setup-progress"
				role="progressbar"
				aria-valuemin={ 0 }
				aria-valuemax={ 100 }
				aria-valuenow={ percent }
				aria-label={ __( 'Storage used', 'godam' ) }
			>
				<span style={ { width: `${ percent }%` } } />
			</div>
			<p className="godam-setup-side-card__text">
				{ sprintf(
					/* translators: 1: storage used in GB, 2: total storage in GB. */
					__( '%1$s GB of %2$s GB', 'godam' ),
					Number( used.toFixed( 2 ) ),
					Number( total.toFixed( 2 ) ),
				) }
			</p>
		</div>
	);
};

/**
 * The checklist card plus the Storage and "Need a hand?" cards beside it.
 *
 * @since n.e.x.t
 *
 * @return {JSX.Element} The setup view.
 */
const SetupChecklist = () => {
	const { data, isLoading, isError, refetch } = useFetchSetupChecklistQuery();
	const steps = Array.isArray( data?.steps ) ? data.steps : [];
	const nextId = steps.find( ( step ) => ! step.done )?.id;
	const done = steps.filter( ( step ) => step.done ).length;
	const percent = steps.length ? Math.round( ( done / steps.length ) * 100 ) : 0;

	let body;
	if ( isLoading ) {
		body = <p className="godam-setup-checklist__status">{ __( 'Checking your setup…', 'godam' ) }</p>;
	} else if ( isError || ! steps.length ) {
		body = (
			<div className="godam-setup-checklist__status" role="alert">
				{ __( 'Your setup steps could not load.', 'godam' ) }{ ' ' }
				<Button variant="link" onClick={ refetch }>{ __( 'Try again', 'godam' ) }</Button>
				{ ' · ' }
				<a href={ SUPPORT_URL } target="_blank" rel="noopener noreferrer">{ __( 'Contact support', 'godam' ) }</a>
			</div>
		);
	} else {
		body = (
			<>
				<div
					className="godam-setup-progress"
					role="progressbar"
					aria-valuemin={ 0 }
					aria-valuemax={ 100 }
					aria-valuenow={ percent }
					aria-label={ __( 'Setup progress', 'godam' ) }
				>
					<span style={ { width: `${ percent }%` } } />
				</div>
				<ol className="godam-setup-checklist__steps">
					{ steps.map( ( step ) => {
						const { label, action } = describeStep( step );
						let state = 'todo';
						if ( step.done ) {
							state = 'done';
						} else if ( step.id === nextId ) {
							state = 'next';
						}
						const badge = {
							done: __( 'Done', 'godam' ),
							next: __( 'Next', 'godam' ),
							todo: __( 'To do', 'godam' ),
						}[ state ];

						return (
							<li
								key={ step.id }
								className={ `godam-setup-step is-${ state }` }
								data-test-id={ `godam-setup-step-${ step.id }` }
							>
								<span className="godam-setup-step__badge">{ badge }</span>
								<span className="godam-setup-step__label">{ label }</span>
								{ ! step.done && action && (
									<Button
										variant={ 'next' === state ? 'primary' : 'secondary' }
										size="compact"
										href={ action.href }
										{ ...( action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {} ) }
									>
										{ action.text }
									</Button>
								) }
							</li>
						);
					} ) }
				</ol>
			</>
		);
	}

	return (
		<div className="godam-setup" data-test-id="godam-setup-checklist">
			<section className="godam-card godam-setup-checklist">
				<div className="godam-card__head">
					<h2>{ __( 'Get your first video live', 'godam' ) }</h2>
					{ steps.length > 0 && ! isError && (
						<span className="godam-setup-checklist__count">
							{ sprintf(
								/* translators: 1: steps done, 2: total steps. */
								__( '%1$d of %2$d done', 'godam' ),
								done,
								steps.length,
							) }
						</span>
					) }
				</div>
				{ body }
				<p className="godam-setup-checklist__note">
					{ __( 'Plays and watch time show up on this dashboard once people start watching your videos.', 'godam' ) }
				</p>
			</section>
			<div className="godam-setup__side">
				<StorageCard />
				<div className="godam-card godam-setup-side-card" data-test-id="godam-setup-help">
					<div className="godam-card__head">
						<h2>{ __( 'Need a hand?', 'godam' ) }</h2>
					</div>
					<p className="godam-setup-side-card__text">
						{ __( 'Our team can plan a move from another video host with you.', 'godam' ) }
					</p>
					<Button variant="secondary" href={ SUPPORT_URL } target="_blank" rel="noopener noreferrer">
						{ __( 'Talk to us', 'godam' ) }
					</Button>
				</div>
			</div>
		</div>
	);
};

export default SetupChecklist;
