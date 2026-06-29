/**
 * WordPress dependencies
 */
import { Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useEffect, useRef } from '@wordpress/element';

/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * Internal dependencies
 */
import SidePanel from './SidePanel';
import { clearNotice } from '../redux/slice/onboarding';

/**
 * Onboarding modal shell — a centered card over a dimmed scrim (the GoDAM
 * dashboard sits behind it). Two layouts from the design: `split` (two-pane:
 * content + marketing side panel, the auth screens) and `dialog` (a single
 * narrow card: workspace select / success / error).
 *
 * @param {Object}      props             Props.
 * @param {JSX.Element} props.children    The active screen content.
 * @param {string}      [props.layout]    'split' | 'dialog'.
 * @param {string}      [props.sidePanel] Side-panel variant for split layout.
 */
const OnboardingModal = ( { children, layout = 'split', sidePanel = 'features' } ) => {
	const notice = useSelector( ( state ) => state.onboarding.notice );
	const dispatch = useDispatch();

	// Keep keyboard focus inside the modal (it overlays a dimmed, non-interactive
	// page) and move focus into it on mount. The overlay isn't dismissible until
	// the site connects, so there's deliberately no Esc-to-close.
	const modalRef = useRef( null );
	useEffect( () => {
		const node = modalRef.current;
		if ( ! node ) {
			return undefined;
		}
		const selector = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
		const tabbable = () => Array.from( node.querySelectorAll( selector ) ).filter( ( el ) => null !== el.offsetParent );
		tabbable()[ 0 ]?.focus();
		const onKeyDown = ( event ) => {
			if ( 'Tab' !== event.key ) {
				return;
			}
			const items = tabbable();
			if ( ! items.length ) {
				return;
			}
			const first = items[ 0 ];
			const last = items[ items.length - 1 ];
			if ( event.shiftKey && node.ownerDocument.activeElement === first ) {
				event.preventDefault();
				last.focus();
			} else if ( ! event.shiftKey && node.ownerDocument.activeElement === last ) {
				event.preventDefault();
				first.focus();
			}
		};
		node.addEventListener( 'keydown', onKeyDown );
		return () => node.removeEventListener( 'keydown', onKeyDown );
	}, [] );

	return (
		<div className="godam-onboarding" data-test-id="godam-onboarding-root">
			<div className="godam-onboarding__scrim" />
			<div ref={ modalRef } className={ `godam-onboarding__modal godam-onboarding__modal--${ layout }` } role="dialog" aria-modal="true" aria-label={ __( 'GoDAM onboarding', 'godam' ) }>
				<div className="godam-onboarding__content">
					{ notice && (
						<Notice
							status={ notice.status || 'error' }
							onRemove={ () => dispatch( clearNotice() ) }
							className="godam-onboarding__notice"
						>
							{ notice.message }
						</Notice>
					) }
					{ children }
				</div>
				{ layout === 'split' && <SidePanel variant={ sidePanel } /> }
			</div>
		</div>
	);
};

export default OnboardingModal;
