/**
 * WordPress dependencies
 */
import { Notice } from '@wordpress/components';

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

	return (
		<div className="godam-onboarding" data-test-id="godam-onboarding-root">
			<div className="godam-onboarding__scrim" />
			<div className={ `godam-onboarding__modal godam-onboarding__modal--${ layout }` } role="dialog" aria-modal="true">
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
