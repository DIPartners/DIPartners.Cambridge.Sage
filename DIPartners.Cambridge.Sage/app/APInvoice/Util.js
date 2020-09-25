function addRowToTable(tableID) {

	var tbl = document.getElementById(tableID);
	var row = tbl.insertRow(lastRow - 1);
	var lastRow = tbl.rows.length;
	var iteration = lastRow - 2;

	var cellLeft = row.insertCell(0);
	var el = document.createElement('input');
	el.setAttribute('type', 'checkbox');
	el.setAttribute('id', 'chk' + iteration);
	cellLeft.appendChild(el);

	var cellRight1 = row.insertCell(1);
	var el = document.createElement('input');
	el.setAttribute('type', 'text');
	el.setAttribute('id', 'ItemNumber' + iteration);
	cellRight1.appendChild(el);

	var cellRight2 = row.insertCell(2);
	var el = document.createElement('input');
	el.setAttribute('type', 'text');
	el.setAttribute('id', 'Quantity' + iteration);
	el.onkeyup = function () { Calculate('Quantity' + iteration, 'UnitPrice' + iteration, 'Extension' + iteration, tableID) }
	cellRight2.appendChild(el);

	var cellRight3 = row.insertCell(3);
	var el = document.createElement('input');
	el.setAttribute('type', 'text');
	el.setAttribute('type', 'text');
	el.setAttribute('id', 'UnitPrice' + iteration);
	el.onkeyup = function () { Calculate('Quantity' + iteration, 'UnitPrice' + iteration, 'Extension' + iteration, tableID) }
	cellRight3.appendChild(el);

	var cellRight4 = row.insertCell(4);
	var el = document.createElement('input');
	el.setAttribute('type', 'text');
	el.setAttribute('id', 'Extension' + iteration);
	el.setAttribute("readonly", 'true');
	cellRight4.appendChild(el);
}

function Calculate(_qty, _unit, _ext) {
	var Ext = document.getElementById(_ext);
	var Qty = document.getElementById(_qty).value;
	var Unit = document.getElementById(_unit).value;
	var Total = (Unit.substring(0, 1) == "$") ? Qty * Unit.substr(1) * 1 : Qty * Unit * 1;
	Ext.value = '$' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function deleteRow(tableID) {
	try {
		var table = document.getElementById(tableID);
		var rowCount = table.rows.length;

		for (var i = 0; i < rowCount; i++) {
			var row = table.rows[i];
			var chkbox = row.cells[0].childNodes[0];
			if (null != chkbox && true == chkbox.checked) {
				if (rowCount <= 1) {
					alert("Cannot delete all the rows.");
					break;
				}
				table.deleteRow(i);
				rowCount--;
				i--;
			}
		}
	} catch (e) {
		alert(e);
	}
}