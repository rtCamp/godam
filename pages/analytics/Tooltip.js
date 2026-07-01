/**
 * WordPress dependencies
 */
import { info } from '@wordpress/icons';
import { Icon } from '@wordpress/components';

const Tooltip = ( { text } ) => {
	return (
		// Focusable + labelled so keyboard and assistive-tech users can reach
		// the metric description (previously a non-focusable, hover-only span).
		// The visual tooltip still reveals on hover, and on :focus-within where
		// the consuming stylesheet supports it (e.g. the video-editor stat row).
		<span
			id="tooltip-container"
			className="tooltip-container"
			tabIndex={ 0 }
			role="img"
			aria-label={ text }
		>
			<Icon icon={ info } size={ 13 } />
			<span className="tooltip-text">{ text }</span>
		</span>
	);
};

export default Tooltip;
