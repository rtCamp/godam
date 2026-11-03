/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Notice } from '@wordpress/components';

/**
 * Internal dependencies
 */
import '../shared/analytics-unavailable.scss';

/**
 * Whether the analytics request was refused because the current user may not
 * read this video's analytics: the route answers 403 for a video the user
 * cannot edit, such as an Author opening someone else's video.
 *
 * @since 2.7.0
 *
 * @param {Object|undefined} error The query's error, as RTK Query's fetchBaseQuery returns it.
 * @return {boolean} True for a 403 answer.
 */
export const isAnalyticsForbidden = ( error ) => 403 === error?.status;

/**
 * Shown instead of the analytics when the user may not read this video's analytics.
 *
 * @since 2.7.0
 *
 * @return {JSX.Element} The notice.
 */
const AnalyticsForbiddenNotice = () => (
	<div className="godam-analytics-forbidden" data-test-id="godam-analytics-notice-analytics-forbidden">
		<Notice status="warning" isDismissible={ false }>
			<strong>{ __( 'You can’t view analytics for this video.', 'godam' ) }</strong>{ ' ' }
			{ __( 'Analytics is shown only for videos you can edit. Choose one of your own videos, or ask an Editor or Administrator.', 'godam' ) }
		</Notice>
	</div>
);

export default AnalyticsForbiddenNotice;
