/**
 * React shell for the Media Library guided tour: the bulb button (portalled
 * next to Manage Media), the first-run welcome, the end-tour confirm and the
 * finish dialog. The step-by-step highlighting itself lives in controller.js.
 */

/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback, useRef, createPortal } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import ConfirmModal from '../../godam/components/ConfirmModal.jsx';
import WelcomeModal from './WelcomeModal.jsx';
import FinishModal from './FinishModal.jsx';
import BulbButton from './BulbButton.jsx';
import * as tour from '../controller';
import { shouldAutoStart, setTourState, TOUR_STATES, readSession, writeSession, tourConfig, getTourState } from '../state';
import { isGridMode, waitFor, SELECTORS, $visible } from '../dom';

/**
 * Wait until the folder sidebar and the media grid have rendered, so the tour
 * never opens over a half-loaded page.
 *
 * @return {Promise<void>} Resolves when ready (or after a timeout).
 */
const waitForPageReady = async () => {
	await waitFor( () => document.querySelector( `${ SELECTORS.sidebar } .folder-container` ), 10000 );
	// List view has no media grid; the welcome there only needs the sidebar.
	if ( ! isGridMode() ) {
		return;
	}
	// Folders + first page of media (either may legitimately be empty).
	await waitFor( () => $visible( SELECTORS.firstAttachment ) || document.querySelector( `${ SELECTORS.grid } .attachments-browser .no-media` ), 8000 );
};

/**
 * @param {Object}  props
 * @param {Element} props.bulbContainer Element the bulb button is portalled into.
 * @return {JSX.Element} The tour shell.
 */
const TourApp = ( { bulbContainer } ) => {
	// 'welcome' | 'end' | 'finish' | null
	const [ modal, setModal ] = useState( null );
	const [ neverTaken, setNeverTaken ] = useState( getTourState() === TOUR_STATES.PENDING );
	// The bulb works while the page is still loading; once it's used, the
	// first-run welcome must not pop up over whatever the user chose.
	const bulbUsed = useRef( false );

	useEffect( () => {
		tour.configure( {
			onRequestEnd: () => setModal( 'end' ),
			onComplete: () => {
				setNeverTaken( false );
				setModal( 'finish' );
			},
		} );
	}, [] );

	// On load: resume an in-progress tour, honour a "start" hand-off from list
	// view, or auto-show the welcome for first-time users.
	useEffect( () => {
		let cancelled = false;

		( async () => {
			const session = readSession();

			if ( session?.stepId || session?.pendingStart ) {
				if ( ! isGridMode() ) {
					return;
				}
				setNeverTaken( false );
				await waitForPageReady();
				if ( ! cancelled ) {
					tour.start( session.pendingStart ? {} : { stepId: session.stepId, context: session.ctx } );
				}
				return;
			}

			if ( shouldAutoStart() ) {
				await waitForPageReady();
				if ( ! cancelled && ! bulbUsed.current && shouldAutoStart() ) {
					setModal( 'welcome' );
				}
			}
		} )();

		return () => {
			cancelled = true;
		};
	}, [] );

	const startTour = useCallback( async () => {
		setModal( null );
		setNeverTaken( false );

		// The tour lives on the grid view (media tiles, drag & drop). From list
		// view, hand the start over to the grid page through sessionStorage.
		if ( ! isGridMode() ) {
			writeSession( { pendingStart: true } );
			window.location.href = tourConfig.gridUrl || 'upload.php?mode=grid';
			return;
		}

		await waitForPageReady();
		tour.start();
	}, [] );

	const handleBulbClick = () => {
		bulbUsed.current = true;
		if ( tour.isActive() ) {
			return;
		}
		setModal( 'welcome' );
	};

	const handleSkip = () => {
		setModal( null );
		setNeverTaken( false );
		setTourState( TOUR_STATES.DISMISSED );
	};

	const handleEndConfirm = () => {
		setModal( null );
		tour.dismiss();
	};

	const handleEndCancel = () => {
		setModal( null );
		tour.resume();
	};

	return (
		<>
			{ bulbContainer && createPortal( <BulbButton onClick={ handleBulbClick } pulse={ neverTaken } />, bulbContainer ) }

			<WelcomeModal isOpen={ 'welcome' === modal } onSkip={ handleSkip } onConfirm={ startTour } />

			<ConfirmModal
				isOpen={ 'end' === modal }
				title={ __( 'End the tour?', 'godam' ) }
				confirmLabel={ __( 'End tour', 'godam' ) }
				cancelLabel={ __( 'Keep going', 'godam' ) }
				onConfirm={ handleEndConfirm }
				onCancel={ handleEndCancel }
				data-test-id="godam-ml-tour-end-modal"
			>
				{ __( 'You can pick it up again anytime from the bulb button next to Manage Media.', 'godam' ) }
			</ConfirmModal>

			<FinishModal isOpen={ 'finish' === modal } onClose={ () => setModal( null ) } />
		</>
	);
};

export default TourApp;
