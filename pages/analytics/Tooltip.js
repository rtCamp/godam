const Tooltip = ( { text } ) => {
	return (
		<span id="tooltip-container">
			<span className="tooltip-icon">ℹ</span>
			<span className="tooltip-text">{ text }</span>
		</span>
	);
};

export default Tooltip;
