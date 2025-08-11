let ToggleFoldersButton = wp?.media?.View;

ToggleFoldersButton = ToggleFoldersButton?.extend( {
	tagName: 'button',
	id: 'media-folder-toggle-button',
	className: 'button media-button',
	events: {
		click: 'onButtonClick',
	},

	initialize() {
		wp.media.View.prototype.initialize.apply( this, arguments );
		this.updateButtonText();

		this._boundToggleFolders = this.toggleFolders.bind( this );

		// Attach listener to the `.media-frame-menu-toggle` button
		const onReady = () => {
			const externalToggle = document.querySelector( '.media-frame-menu-toggle' );
			if ( externalToggle ) {
				externalToggle.addEventListener( 'click', this._boundToggleFolders );
				externalToggle.setAttribute( 'aria-expanded', 'false' );
			}
		};

		if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', onReady, { once: true } );
		} else {
			onReady();
		}
	},

	onButtonClick() {
		this.toggleFolders();
	},

	toggleFolders() {
		const sidebar = document.getElementById( 'rt-transcoder-media-library-root' );
		if ( sidebar ) {
			sidebar.classList.toggle( 'hide-sidebar' );
		}
		const mediaModal = document.querySelector( '.media-modal-content' );
		if ( mediaModal ) {
			mediaModal.classList.toggle( 'hide-sidebar' );
		}
		this.updateButtonText();
	},

	updateButtonText() {
		const sidebar = document.getElementById( 'rt-transcoder-media-library-root' );
		const isHidden = !! ( sidebar && sidebar.classList.contains( 'hide-sidebar' ) );

		this.el.innerHTML = `${ folderIconSvg } ${ isHidden ? 'Show Folders' : 'Hide Folders' }`;
		this.el.setAttribute( 'aria-expanded', String( ! isHidden ) );

		const externalToggle = document.querySelector( '.media-frame-menu-toggle' );
		if ( externalToggle ) {
			externalToggle.setAttribute( 'aria-expanded', String( ! isHidden ) );
		}
	},

	render() {
		wp.media.View.prototype.render.apply( this, arguments );
		this.updateButtonText();
		return this;
	},
} );

const folderIconSvg = `
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9.51382 6C9.39567 5.99993 9.27987 5.96541 9.17939 5.9003C9.07891 5.83519 8.99772 5.74205 8.94491 5.63133L8.34164 4.36867C8.28882 4.25795 8.20763 4.16481 8.10715 4.0997C8.00667 4.03459 7.89088 4.00007 7.77273 4H3.63636C3.46759 4 3.30573 4.07024 3.18639 4.19526C3.06705 4.32029 3 4.48986 3 4.66667V15.3333C3 15.5101 3.06705 15.6797 3.18639 15.8047C3.30573 15.9298 3.46759 16 3.63636 16H16.3636C16.5324 16 16.6943 15.9298 16.8136 15.8047C16.933 15.6797 17 15.5101 17 15.3333V6.66667C17 6.48986 16.933 6.32029 16.8136 6.19526C16.6943 6.07024 16.5324 6 16.3636 6H9.51382Z" stroke="#1C1C1C" stroke-width="0.875" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

export default ToggleFoldersButton;
