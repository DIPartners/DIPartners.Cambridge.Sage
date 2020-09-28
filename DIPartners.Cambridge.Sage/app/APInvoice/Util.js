function addRowToTable(tableID) {
	var tbl = document.getElementById(tableID);
	var lastRow = tbl.rows.length;
	var row = tbl.insertRow(lastRow - 1);
	var iteration = lastRow - 2;



	var tempExt = tbl.rows[lastRow - 2].cells[4].innerHTML;
	tempExt = tbl.rows[iteration].cells[4].innerHTML.split("\"")[1]; // extract a last id
	iteration = parseInt(tempExt.match(/\d+/)[0]) + 1;



	var cellLeft = row.insertCell(0);
	var el = document.createElement('input');
	el.setAttribute('type', 'checkbox');
	el.setAttribute('id', 'chk' + iteration);
	el.setAttribute('onclick', 'removeRow(this)');
	el.setAttribute('clsss', 'le-checkbox');
	//el.setAttribute('value', '-');
	//el.setAttribute('onclick', 'removeRow(this)');
	//el.innerHTML = '-';
	cellLeft.appendChild(el);

	var startCell = iteration / iteration;

	for (var i = iteration; i < iteration + 4; i++) {
		var id = "";
		var cellRight = row.insertCell(startCell);
		var el = document.createElement('input');

		if (startCell == 1) id = "ItemNumber";
		else if (startCell == 2) id = "Quantity";
		else if (startCell == 3) id = "UnitPrice";
		else if (startCell == 4) id = "Extension";

		el.setAttribute('type', 'text');
		el.setAttribute('id', id + iteration);
		if (startCell == 2 || startCell == 3)
			el.setAttribute('onkeyup', 'Calculate(\'Quantity' + iteration + '\', \'UnitPrice' + iteration + '\', \'Extension' + iteration + '\')');
		//el.onkeyup = function () { Calculate('Quantity' + iteration, 'UnitPrice' + iteration, 'Extension' + iteration, tableID) }
		if (startCell == 4)
			el.setAttribute("readonly", 'true');

		el.setAttribute("placeholder", '');
		el.setAttribute("value", '');

		cellRight.appendChild(el);
		startCell++;
	}
}

function Calculate(_qty, _unit, _ext) {
	var Ext = document.getElementById(_ext);
	var Qty = document.getElementById(_qty).value;
	var Unit = document.getElementById(_unit).value;
	var Total = (Unit.substring(0, 1) == "$") ? Qty * Unit.substr(1) * 1 : Qty * Unit * 1;
	Ext.value = '$' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 });

	CalculateTotal();
}

function CalculateTotal() {
	var tbl = document.getElementById('invoice_details_table');
	var lastRow = tbl.rows.length - 1;	// header
	var Ext = 0;
	for (var i = 0; i < lastRow; i++) {
		if (document.getElementById('Extension' + i) != undefined) {
			var currency = document.getElementById('Extension' + i).value;
			Ext += Number(currency.replace(/[^0-9.-]+/g, ""));
		}
	}

	document.getElementById('Total').value = '$' + Ext.toLocaleString('en-US', { minimumFractionDigits: 2 });
	document.getElementById('subtotal').value = '$' + Ext.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function CalculateTotal1() {
	var tbl = document.getElementById('invoice_details_table');
	var lastRow = tbl.rows.length - 1;	// header;
	var Ext = 0;
	for (var i = 1; i < lastRow; i++) {
		var tempExt = tbl.rows[i].cells[4].innerHTML;
		tempExt = tempExt.split("\"");
		tempExt = tempExt[tempExt.length - 2].substr(1);
		Ext += Number(tempExt.replace(/[^0-9.-]+/g, ""));
	}

	document.getElementById('Total').value = '$' + Ext.toLocaleString('en-US', { minimumFractionDigits: 2 });
	document.getElementById('subtotal').value = '$' + Ext.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function removeRow(sender) {
	$(sender).parent().parent().remove();
	CalculateTotal();
}