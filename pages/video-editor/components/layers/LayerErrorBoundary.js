/**
 * WordPress dependencies
 */
import { Component } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

/**
 * Error boundary for individual layer editors.
 *
 * Layer editor components can be provided by add-ons (e.g. GoDAM for
 * WooCommerce) whose version may not match this editor's API. A render error
 * in one of those components must not white-screen the whole Video Editor, so
 * this boundary catches it and shows a recoverable fallback instead. This is
 * the core-side half of the GoDAM 2.0 forward/backward-compatibility contract:
 * a stale or incompatible add-on degrades gracefully rather than crashing.
 */
class LayerErrorBoundary extends Component {
	constructor( props ) {
		super( props );
		this.state = { hasError: false };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch( error ) {
		// eslint-disable-next-line no-console
		console.error( 'GoDAM Video Editor: a layer editor failed to render.', error );
	}

	componentDidUpdate( prevProps ) {
		// Reset when the user switches to a different layer so a single broken
		// layer doesn't keep the fallback shown for every other layer.
		if ( this.state.hasError && prevProps.resetKey !== this.props.resetKey ) {
			this.setState( { hasError: false } ); // eslint-disable-line react/no-did-update-set-state
		}
	}

	render() {
		if ( this.state.hasError ) {
			return (
				<div className="godam-layer-error" role="alert">
					<p>
						{ __(
							'This layer could not be opened. It may be provided by an add-on that needs updating to work with this version of GoDAM.',
							'godam',
						) }
					</p>
					{ this.props.goBack && (
						<Button variant="secondary" onClick={ this.props.goBack }>
							{ __( 'Back to layers', 'godam' ) }
						</Button>
					) }
				</div>
			);
		}

		return this.props.children;
	}
}

export default LayerErrorBoundary;
