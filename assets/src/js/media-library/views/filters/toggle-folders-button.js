let ToggleFoldersButton = wp?.media?.View;

ToggleFoldersButton = ToggleFoldersButton?.extend( {
	tagName: 'button',
	className: 'button media-button',
	events: {
		click: 'onButtonClick',
	},

	initialize() {
		wp.media.View.prototype.initialize.apply( this, arguments );
		this.updateButtonText();
	},

	onButtonClick() {
		const sidebar = document.getElementById( 'rt-transcoder-media-library-root' );
		if ( sidebar ) {
			sidebar.classList.toggle( 'hide-sidebar' ); this.updateButtonText();
		} const mediaModal = document.querySelector( '.media-modal-content' ); if ( mediaModal ) {
			mediaModal.classList.toggle( 'hide-sidebar' ); this.updateButtonText();
		}
	},

	updateButtonText() {
		const sidebar = document.getElementById( 'rt-transcoder-media-library-root' );
		if ( sidebar && sidebar.classList.contains( 'hide-sidebar' ) ) {
			this.el.innerHTML = '<span class="dashicons dashicons-category"></span> Show Folders';
		} else {
			this.el.innerHTML = '<span class="dashicons dashicons-category"></span> Hide Folders';
		}
	},

	render() {
		wp.media.View.prototype.render.apply( this, arguments );
		this.updateButtonText();
		return this;
	},
} );

export default ToggleFoldersButton;
