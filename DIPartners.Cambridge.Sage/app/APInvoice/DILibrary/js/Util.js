function addRowToTable(tableID)
{
	var tbl = document.getElementById(tableID);
	var lastRow = tbl.rows.length;
	var row = tbl.insertRow(lastRow-1);
	var iteration = lastRow - 2;

	iteration = (lastRow == 2) ? 1 : Number(tbl.rows[lastRow - 2].cells[4].firstChild.id.replace(/[^0-9.-]+/g, ""))+1;

	var cellLeft = row.insertCell(0);
	var el = document.createElement('IMG');
	el.setAttribute('src', 'DILibrary/images/remove-button-red.png');
	el.setAttribute('style', 'padding-left:0px;text-align:center;');
	el.setAttribute('id', 'chk');
	el.setAttribute('onclick', 'removeRow(this)');

	cellLeft.appendChild(el);
	cellLeft.style.padding = '0 0 0 0px';
	cellLeft.style.textAlign = 'center';

	var startCell = iteration / iteration;

	for (var i = iteration; i < iteration + 5; i++)
	{
		var id = "";
		var cellRight = row.insertCell(startCell);
		var el = document.createElement('input');

		if (startCell == 1) id = "ItemNumber";
		else if (startCell == 2) id = "Quantity";
		else if (startCell == 3) id = "UnitPrice";
		else if (startCell == 4) id = "Extension";
		else if (startCell == 5) id = "PONumber";

		el.setAttribute('type', 'text');
		el.setAttribute('id', id + iteration);
		if (startCell == 2 || startCell == 3) {
			el.setAttribute('onkeyup', 'Calculate(\'Quantity' + iteration + '\', \'UnitPrice' + iteration + '\', \'Extension' + iteration + '\')');
			el.setAttribute('onkeypress', 'return isNumberKey(event,this.id)');
		}
		if (startCell == 4)
			el.setAttribute("readonly", 'true');
		/*if (startCell == 5) {
			el.setAttribute("readonly", 'false');
			el.setAttribute('onkeypress', 'return isNumberKey(event,this.id)');
		}*/

		/*el.setAttribute("placeholder", '');
		el.setAttribute("value", '');*/
			
		cellRight.appendChild(el);
		startCell++;
	}
	ChangeValue(false);
}

function Calculate(_qty, _unit, _ext)
{
	var Ext = document.getElementById(_ext);
	var Qty = document.getElementById(_qty).value;


	var Unit = document.getElementById(_unit).value;
	if (Unit.substring(0, 1) != "$") document.getElementById(_unit).value = '$' + Unit;

	var Total = (Unit.substring(0, 1) == "$") ? Qty * Unit.substr(1) * 1 : Qty * Unit * 1;
	Ext.value = '$' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 });

	ChangeValue(false);
	CalculateTotal();
}

function isNumberKey(evt, id) {
	ChangeValue(false);
	try {
		var charCode = (evt.which) ? evt.which : event.keyCode;

		if (charCode == 46) {	// del key
			var txt = document.getElementById(id).value;
			if (!(txt.indexOf(".") > -1)) {

				return true;
			}
		}
		if (charCode > 31 && (charCode < 48 || charCode > 57))
			return false;

		return true;
	} catch (w) {
		alert(w);
	}
}

function CalculateTotal() {

	var tbl = document.getElementById('invoice_details_table');
	var lastRow = tbl.rows.length - 1;	// header
	var Ext = 0;
	for (var i = 0; i <= lastRow; i++) {
		if (document.getElementById('Extension' + i) != undefined) {
			var currency = document.getElementById('Extension' + i).value;
			
			Ext += Number(currency.replace(/[^0-9.-]+/g, ""));
		}
	}
	document.getElementById('Total').value = '$' + Ext.toLocaleString('en-US', { minimumFractionDigits: 2 });
	setBalanceStyle();
}

function setBalanceStyle() {
	var subTotal = document.getElementById('hSubtotal').value.replace(/[^0-9.-]+/g, "");
	var total = document.getElementById('Total').value.replace(/[^0-9.-]+/g, "");

	var TextLabel = document.getElementById('Balanced');

	if (subTotal != total) {
		TextLabel.innerHTML = "Not Balanced";
		TextLabel.style.color = "red";
		TextLabel.style.background = "rgb(250, 215, 215)";
		TextLabel.style.width = "85px";
	}
	else {
		TextLabel.innerHTML = "Balanced";
		TextLabel.style.color = "green";
		TextLabel.style.background = "rgb(223, 248, 223)";
		TextLabel.style.width = "60px";
	}

	TextLabel.style.height = "22px";
	TextLabel.style.textAlign = "center";
	TextLabel.style.verticalAlign = "sub";
	TextLabel.style.display = "inline-block";
}

function removeRow(sender) {
	$(sender).parent().parent().remove();
	CalculateTotal();
	ChangeValue(false);
}

function ChangeValue(val) {
	document.getElementById("save-data").disabled = val;
	document.getElementById("discard-data").disabled = val;
}

function SortLineNo(ArrayVal) {
	ArrayVal.sort(function (a, b) {
		return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
	});
	return ArrayVal;
}

function GetColIndex(pptName) {

	if (pptName == "ItemNumber") return 1;
	else if (pptName == "Quantity") return 2;
	else if (pptName == "UnitPrice") return 3;
	else if (pptName == "InvoiceLineExtension") return 4;
	else if (pptName == "PONumber") return 5;
}

function CheckNull() {
	var tbl = document.getElementById('invoice_details_table');
	document.getElementById('invoice_details_table').rows.length
	for (var i = 1; i < tbl.rows.length - 1; i++) {
		for (var j = 1; j < 4; j++) {
			var val = tbl.rows[i].cells[j].querySelector('input').value;
			if (val === "" || val === 0 || val === "$") return false;
		}
	}

	return true;
}

function isRequired(assocPropDefs, propertyNumber) {
	for (var i = 0; i < assocPropDefs.Count; i++) {
		if (assocPropDefs[i].PropertyDef == propertyNumber)
			return assocPropDefs[i].Required;
	}
	return false;
}
function SetButton() {
	var saveLabel = GetText("IDS_METADATACARD_COMMAND_SAVE");
	var discardLabel = GetText("IDS_METADATACARD_BUTTON_DISCARD");
	var saveTooltip = GetText("IDS_METADATACARD_BUTTON_TOOLTIP_SAVE");

	$("#save-data").text(saveLabel);
	$("#save-data").attr("title", saveTooltip);
	$("#discard-data").text(discardLabel);
	$(window).resize(function () {
		ResizeContentArea();
	});
}

function GetText(id) {
    switch (id) {
		case id = "IDS_METADATACARD_COMMAND_SAVE": id = 27593; break;
		case id = "IDS_METADATACARD_BUTTON_DISCARD": id = 27614; break;
		case id = "IDS_METADATACARD_BUTTON_TOOLTIP_SAVE": id = 27929; break;	
	}

	// Get localized text from MFShell.
	var localizedString = null;
	try {
		localizedString = MFiles.GetStringResource(id);
	}
	catch (ex) {
	}
	return (localizedString != null) ? localizedString : "";
}

function ResizeContentArea() {

	// Figure out all heights.
	win = $(window).outerHeight(),
	footer = $("#mf-footer").outerHeight(),
	content = win - footer;
	$(".panel-container").height(content - $("#titleLabel").height());

	// Set height of the content area.
	var pch = $(".panel-container").height();
	var tabh = $(".ui-tabs-nav").height();
	$(".mf-layout-vertical").height(win);
	$(".ui-tabs-panel").height(pch - tabh);
	$(".mf-section-properties").outerHeight($(".ui-tabs-panel").height());
}
