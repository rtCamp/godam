/**
 * Product guide orchestrator.
 *
 * Mounted once at the top of the Video Editor app (above the list/editor view
 * switch) so it spans the whole guided tour. It auto-shows the "Get Started"
 * welcome modal for first-time users, wires the coachmark popover's close (X)
 * to an "end guide?" confirm, and prompts to drop the video into a new draft
 * page after the final Copy step.
 *
 * The coachmark sequence itself is driven by the productGuide controller; the
 * targeted components call `productGuide.notify()` for action-gated steps.
 */

/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import ConfirmModal from '../../godam/components/ConfirmModal.jsx';
import WelcomeChooserModal, { WELCOME_CHOICES } from './WelcomeChooserModal.jsx';
import WelcomeIntroModal from './WelcomeIntroModal.jsx';
import { useProductGuide } from './useProductGuide';
import { shouldAutoStartGuide, setProductGuideState, PRODUCT_GUIDE_STATES } from './productGuideState';
import { getGoDAMVideoBlockMarkup } from '../utils';
import { launchWooBlockTour } from './wooTour';
import { setTourPrioritizeId } from './tourPrioritize';

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

/**
 * Poll until the demo video is the FIRST card in the list (up to `timeout` ms),
 * so the guide's first step highlights the demo — not whatever card was first
 * before the list re-ordered. Waiting on mere existence isn't enough: a demo
 * created earlier may already sit lower in the list by date until the reorder
 * lands.
 *
 * @param {number} attachmentId Demo attachment id.
 * @param {number} [timeout]    Max wait in ms.
 * @return {Promise<void>} Resolves when the demo is first, or the timeout elapses.
 */
const waitForDemoFirst = ( attachmentId, timeout = 6000 ) =>
	new Promise( ( resolve ) => {
		const target = `godam-video-editor-element-card-${ attachmentId }`;
		const isFirst = () => {
			const first = document.querySelector( '[data-test-id^="godam-video-editor-element-card-"]' );
			return first && first.getAttribute( 'data-test-id' ) === target;
		};
		if ( isFirst() ) {
			resolve();
			return;
		}
		let waited = 0;
		const interval = 120;
		const timer = setInterval( () => {
			if ( isFirst() || waited >= timeout ) {
				clearInterval( timer );
				resolve();
			}
			waited += interval;
		}, interval );
	} );

/**
 * @param {Object}  props
 * @param {?number} props.attachmentID Currently-open video (null on the list view).
 * @return {JSX.Element} The guide's modal layer.
 */
const ProductGuide = ( { attachmentID } ) => {
	// Which guide modal is open: 'welcome' | 'end' | 'addToPage' | null.
	const [ modal, setModal ] = useState( null );
	const [ isBusy, setBusy ] = useState( false );

	// The welcome becomes a two-card chooser only when the GoDAM-for-Woo Shoppable
	// Video tour is available (it owns the block the Woo path walks through);
	// otherwise the single Get-Started welcome is used. Named to match the
	// videoData.wooGuideActive flag and avoid confusion with the separate
	// `wooActive` (= WooCommerce) flag also localized in class-pages.php.
	const wooGuideActive = Boolean( window?.videoData?.wooGuideActive );

	const onRequestEnd = useCallback( () => setModal( 'end' ), [] );
	const onFinalAction = useCallback( () => {
		// Final step reached — stop pinning the demo first in the list.
		setTourPrioritizeId( 0 );
		setModal( 'addToPage' );
	}, [] );
	// "See how it works" re-opens the welcome dialog (chooser or single).
	const onRequestWelcome = useCallback( () => setModal( 'welcome' ), [] );

	const { start, resume, dismiss } = useProductGuide( { onRequestEnd, onFinalAction, onRequestWelcome } );

	// Auto-show the welcome modal once, for first-time users — but only when the
	// app opens on the list view (no `?id=`), never when deep-linking straight
	// into the editor (the welcome belongs on the list, and its first guide step
	// targets a list card). Mounted once above the view switch, so this runs a
	// single time and navigating list → editor doesn't re-trigger it.
	useEffect( () => {
		const hasAttachmentInUrl = new URLSearchParams( window.location.search ).get( 'id' );
		if ( ! hasAttachmentInUrl && shouldAutoStartGuide() ) {
			setModal( 'welcome' );
		}
	}, [] );

	// Welcome → start the interactive tour. First ensure the demo video exists and
	// pin it first in the list, so step 1 highlights real demo content.
	const handleStart = async () => {
		setModal( null );
		try {
			const res = await fetch( window.pathJoin( [ restURL, 'godam/v1/onboarding/demo-video' ] ), {
				headers: { 'X-WP-Nonce': window?.videoData?.nonce || window?.wpApiSettings?.nonce },
			} );
			const data = await res.json();
			const demoId = Number( data?.id ) || 0;
			if ( demoId ) {
				setTourPrioritizeId( demoId );
				await waitForDemoFirst( demoId );
			}
		} catch {
			// Demo unavailable — start anyway; the tour highlights whatever's first.
		}
		start();
	};

	// Welcome → "Skip for now": don't auto-show again, but leave the re-launch
	// entry point ("See how it works") available.
	const handleSkipWelcome = () => {
		setModal( null );
		setProductGuideState( PRODUCT_GUIDE_STATES.DISMISSED );
	};

	// Welcome chooser → branch on the selected card.
	const handleChooseWelcome = async ( choice ) => {
		if ( choice === WELCOME_CHOICES.WOO ) {
			// Hand off to the in-editor Shoppable Video tour. Mark the core guide
			// dismissed so this welcome won't auto-show again (the "See how it
			// works" re-launch stays available for the interactive path).
			setBusy( true );
			setProductGuideState( PRODUCT_GUIDE_STATES.DISMISSED );
			await launchWooBlockTour();
			setBusy( false );
			setModal( null );
			return;
		}
		handleStart();
	};

	// End-guide confirm.
	const handleEndConfirm = () => {
		setModal( null );
		setTourPrioritizeId( 0 );
		dismiss();
	};

	// End-guide cancel → resume where we left off.
	const handleEndCancel = () => {
		setModal( null );
		resume();
	};

	// Add-to-page: create a draft page seeded with the GoDAM video block, then
	// open it in the block editor.
	const handleAddToPage = async () => {
		if ( ! attachmentID ) {
			setModal( null );
			return;
		}
		setBusy( true );
		try {
			const content = await getGoDAMVideoBlockMarkup( attachmentID );
			const response = await fetch( window.pathJoin( [ restURL, 'wp/v2/pages' ] ), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window?.videoData?.nonce || window?.wpApiSettings?.nonce,
				},
				body: JSON.stringify( {
					status: 'draft',
					title: __( 'GoDAM video', 'godam' ),
					content,
				} ),
			} );
			const page = await response.json();
			if ( page?.id ) {
				const adminUrl = window?.videoData?.adminUrl || '/wp-admin/';
				window.open( `${ adminUrl }post.php?post=${ page.id }&action=edit`, '_blank' );
			}
		} catch {
			// Non-fatal — the video block is already on the clipboard from Copy.
		} finally {
			setBusy( false );
			setModal( null );
		}
	};

	return (
		<>
			{ wooGuideActive ? (
				<WelcomeChooserModal
					isOpen={ modal === 'welcome' }
					onSkip={ handleSkipWelcome }
					onChoose={ handleChooseWelcome }
					isBusy={ isBusy }
				/>
			) : (
				<WelcomeIntroModal
					isOpen={ modal === 'welcome' }
					onSkip={ handleSkipWelcome }
					onConfirm={ handleStart }
				/>
			) }

			<ConfirmModal
				isOpen={ modal === 'end' }
				title={ __( 'Do you want to end the product guide?', 'godam' ) }
				confirmLabel={ __( 'End guide', 'godam' ) }
				cancelLabel={ __( 'Keep going', 'godam' ) }
				onConfirm={ handleEndConfirm }
				onCancel={ handleEndCancel }
				data-test-id="godam-product-guide-button-end"
			>
				{ __( 'You can start it anytime using the “See how it works” button on the Video Editor.', 'godam' ) }
			</ConfirmModal>

			<ConfirmModal
				isOpen={ modal === 'addToPage' }
				title={ __( 'Do you want to add it to a page?', 'godam' ) }
				confirmLabel={ __( 'Yes, Continue', 'godam' ) }
				cancelLabel={ __( 'Not now', 'godam' ) }
				onConfirm={ handleAddToPage }
				onCancel={ () => setModal( null ) }
				isBusy={ isBusy }
				data-test-id="godam-product-guide-button-add-to-page"
			>
				{ __( 'We’ll open a new draft page and drop the video right in.', 'godam' ) }
			</ConfirmModal>
		</>
	);
};

export default ProductGuide;
