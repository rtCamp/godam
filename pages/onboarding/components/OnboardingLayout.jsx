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
import MarketingPanel from './MarketingPanel';
import { clearNotice } from '../redux/slice/onboarding';

/**
 * Two-pane onboarding shell: the active screen (left) + marketing panel (right).
 *
 * @param {Object}      props          Component props.
 * @param {JSX.Element} props.children The active screen.
 */
const OnboardingLayout = ( { children } ) => {
	const notice = useSelector( ( state ) => state.onboarding.notice );
	const dispatch = useDispatch();

	return (
		<div className="godam-onboarding" data-test-id="godam-onboarding-root">
			<main className="godam-onboarding__main">
				<div className="godam-onboarding__brand">
					<span className="godam-onboarding__logo">GoDAM</span>
				</div>
				{ notice && (
					<Notice
						status={ notice.status || 'error' }
						onRemove={ () => dispatch( clearNotice() ) }
						className="godam-onboarding__notice"
					>
						{ notice.message }
					</Notice>
				) }
				<div className="godam-onboarding__screen">{ children }</div>
			</main>
			<MarketingPanel />
		</div>
	);
};

export default OnboardingLayout;
