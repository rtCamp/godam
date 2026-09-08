/**
 * WordPress dependencies
 */
import { Component } from '@wordpress/element';

/**
 * Catches anything the pdf.js viewer throws while rendering, and reports it as a load failure.
 *
 * Used on the editor canvas. The viewer's own `onError` only covers the failures react-pdf
 * reports through callbacks; it can also throw outright — pdf.js raises synchronously from
 * react-pdf's load effect when its worker is unusable, for instance — and an uncaught throw
 * from a block's edit component is what produces "This block has encountered an error and
 * cannot be previewed", replacing the whole block.
 *
 * Funnelling both into one `onError` means edit.js has a single fallback to maintain: try the
 * next preview URL, then the download-only panel.
 *
 * Renders nothing once it has caught, since the caller replaces it.
 */
export default class PreviewErrorBoundary extends Component {
	constructor( props ) {
		super( props );
		this.state = { hasError: false };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch( error ) {
		global.console?.error( 'GoDAM: document preview could not be rendered', error );
		this.props.onError?.( error );
	}

	render() {
		return this.state.hasError ? null : this.props.children;
	}
}
