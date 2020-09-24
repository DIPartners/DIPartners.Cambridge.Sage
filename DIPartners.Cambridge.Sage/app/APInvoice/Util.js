
window.onkeyup = function () {

	var items = document.querySelectorAll("#invoice_details_table");
	var itemsArray = Array.prototype.slice.call(items, 0);
	var unit, rate, total, net = 0;
	itemsArray.forEach(function (el) {
		unit = el.querySelector('input[name="Quantity[]"]').value;
		rate = el.querySelector('input[name="UnitPrice[]"]').value;
		rate = rate.substr(1);
		total = unit * rate;
		net += total;
		total = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2 });
		el.querySelector('input[name="Extension[]"]').value = total;
		el.querySelector('input[name="ITotal[]"]').value = net.toLocaleString('en-US', { minimumFractionDigits: 2 });
	});
}

function addRow(tableID) {

	var table = document.getElementById(tableID);

	var rowCount = table.rows.length;
	var row = table.insertRow(rowCount - 1);

	var colCount = table.rows[0].cells.length;

	for (var i = 0; i < colCount; i++) {

		var newcell = row.insertCell(i);

		newcell.innerHTML = table.rows[1].cells[i].innerHTML;

		//alert(newcell.childNodes);
		if (newcell.childNodes[0].childNodes[0].type == "text") {
			newcell.childNodes[0].childNodes[0].value = "";
			newcell.childNodes[0].childNodes[0].placeholder = "";
		}
	}
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
}// JavaScript source code
