// Entry point of the dashboard.
function OnNewDashboard(dashboard) {

    // Parent is a shell pane container (tab), when dashboard is shown in right pane.
    var tab = dashboard.Parent;

    // Initialize console.
    console.initialize(tab.ShellFrame.ShellUI, "APInvoice");

    // Some things are ready only after the dashboard has started.
    dashboard.Events.Register(MFiles.Event.Started, OnStarted);
    function OnStarted() {
        SetDetails(dashboard);
    }

}

function SetDetails(dashboard)
{
    var Vault=dashboard.Vault;
    var controller=dashboard.CustomData;
    controller.Vault=Vault;
//console.log(controller.ObjectVersion);
    // Apply vertical layout.
    $( "body" ).addClass( "mf-layout-vertical" );
    // Show some information of the document.
    $('#message_placeholder').text(controller.ObjectVersion.Title + ' (' + controller.ObjectVersion.ObjVer.ID + ')');

    var ObjectVersionProperties = Vault.ObjectPropertyOperations.GetProperties(controller.ObjectVersion.ObjVer);

    controller.Invoice={
        ObjectVersion:controller.ObjectVersion, 
        ObjectVersionProperties:ObjectVersionProperties,
        Events:dashboard.Events
    };
    
    var PONO = ObjectVersionProperties.SearchForPropertyByAlias(dashboard.Vault, "vProperty.POReference", true).Value.DisplayValue;
    if (PONO != "")
    {
        var ObjectSearchResults = dashboard.Vault.ObjectSearchOperations.SearchForObjectsByConditions(
    			FindObjects(dashboard.Vault,'vOjbect.PurchaseOrder','vProperty.PONumber',MFDatatypeText,PONO), MFSearchFlagNone, true);
        if (ObjectSearchResults.Count == 1)
    	{
            var ObjectVersionProperties = Vault.ObjectPropertyOperations.GetProperties(ObjectSearchResults[0].ObjVer);
/*
            var SearchResultsObjVers = ObjectSearchResults.GetAsObjectVersions().GetAsObjVers()
            var ObjectSearchResultsProperties = dashboard.Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(SearchResultsObjVers);
*/
            controller.PurchaseOrder={
                ObjectVersion:ObjectSearchResults[0],
                ObjectVersionProperties:ObjectVersionProperties,
                PropertyControls:PropertyControls,
                Events:dashboard.Events
            };
            var editor = controller.PurchaseOrder;
            var PropertyControls=new Array();
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.PONumber'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.Vendor'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.PODate'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.PORequiredDate'));
            PropertyControls.push(setProperty(Vault, editor, 'vProperty.Currency'));
            editor.PropertyControls = PropertyControls;
            
            var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
                FindObjects(Vault,'vObject.PurchaseOrderDetail','vProperty.PurchaseOrder',MFDatatypeText, editor.ObjectVersion.Title), MFSearchFlagNone, true);

        }
    }
    controller.PackingSlip={
        ObjectVersion:null,
        ObjectVersionProperties:null,
        PropertyControls:null,
        Events:dashboard.Events
    };


    SetInvoiceDetails(controller);
    $("#tabs").tabs("option", "active", 0);
    SetPODetails(controller);
    SetPSDetails(controller);
}

function SetInvoiceDetails(controller)
{
    var editor=controller.Invoice;
    var Vault=controller.Vault;
    var tabname='Invoice';
    var tabdisplayname=tabname;

    CreateMetadataCard(controller,editor,tabname,tabdisplayname);
	generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.InvoiceNumber')
	generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Date')
	generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Vendor')
	generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.POReference')

	DisplayImage(Vault,editor.ObjectVersionProperties);

/*
    var InvNO = editor.ObjectVersionProperties.SearchForPropertyByAlias(Vault, "vProperty.InvoiceNumber", true).Value.DisplayValue;
*/
    var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			FindObjects(Vault,'vObject.InvoiceDetail','vProperty.Invoice',MFDatatypeLookup, editor.ObjectVersion.ObjVer.ID), MFSearchFlagNone, true);

/*
    var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			FindObjects(Vault,'vObject.InvoiceDetail','vProperty.Invoice',MFDatatypeLookup, InvNO), MFSearchFlagNone, true);
*/
    if (ObjectSearchResults.Count > 0)
    {
        editor.table.append(
            '<tr><td colspan="4" align="center">' +
            '    <table id="invoice_details_table" class="details">' +
            '        <tr><th width="25%">Item</th><th width="25%">Qty</th><th width="25%">Unit $</th><th width="25%">Ext $</th></tr>' +
            '    </table>' +
            '</td></tr>' +
            '');

        var TableBody=editor.table.find('#invoice_details_table');
        var SearchResultsObjVers = ObjectSearchResults.GetAsObjectVersions().GetAsObjVers()
        var ObjectSearchResultsProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(SearchResultsObjVers);
        var Total = 0
        for (var i = 0; i < ObjectSearchResults.Count; i++)
        {
            var result = ObjectSearchResults[i];
            var props = ObjectSearchResultsProperties[i];
            var Item = props.SearchForPropertyByAlias(Vault, "vProperty.ItemNumber", true).Value.DisplayValue;
            var Qty = props.SearchForPropertyByAlias(Vault, "vProperty.Quantity", true).Value.DisplayValue;
            var Price = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.UnitPrice", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var Amount = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.InvoiceLineExtension", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            Total = Total + props.SearchForPropertyByAlias(Vault, "vProperty.InvoiceLineExtension", true).Value.Value
            TableBody.append(
                '<tr>' +
                '<td style="text-align:center"><span id="ItemNumber">' + Item + '</span></td>' +
                '<td style="text-align:right"><span id="Quantity">' + Qty + '</span></td>' +
                '<td style="text-align:right"><span id="UnitPrice">' + Price + '</span></td>' +
                '<td style="text-align:right"><span id="Extension">' + Amount + '</span></td>' +
                "</tr>"
            );
        }
        TableBody.append(
            '<tr>' +
            '<td colspan="3" style="border-bottom: none;border-left: none;">&nbsp;</td>' +
            '<td style="text-align:right">$' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
            '</tr>'
        );
    }
	generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Subtotal')
	generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Verified')
}

function SetPODetails(controller)
{
    var editor=controller.PurchaseOrder;
    var Vault=controller.Vault;
    var tabname='PO' + editor.ObjectVersion.Title;
    var tabdisplayname='PO ' + editor.ObjectVersion.Title;

    CreateMetadataCard(controller,editor,tabname,tabdisplayname);
    
	generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.PONumber')
	generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Vendor')
	generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.PODate')
	generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.PORequiredDate')
	generate_row(editor.table, Vault, editor.ObjectVersionProperties, 'vProperty.Currency')

    var ObjectSearchResults = Vault.ObjectSearchOperations.SearchForObjectsByConditions(
			FindObjects(Vault,'vObject.PurchaseOrderDetail','vProperty.PurchaseOrder',MFDatatypeText, editor.ObjectVersion.Title), MFSearchFlagNone, true);
    if (ObjectSearchResults.Count > 0)
    {
        editor.table.append(
            '<tr><td colspan="4" align="center">' +
            '    <table id="po_details_table" class="details">' +
            '        <tr><th>Line</th><th>Item</th><th>Ordered</th><th>RTD</th><th>Unit $</th><th>Ext $</th><th>Account</th></tr>' +
            '    </table>' +
            '</td></tr>' +
            '');

        var TableBody=editor.table.find('#po_details_table');
        var SearchResultsObjVers = ObjectSearchResults.GetAsObjectVersions().GetAsObjVers()
        var ObjectSearchResultsProperties = Vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(SearchResultsObjVers);
        var Total = 0
        for (var i = 0; i < ObjectSearchResults.Count; i++)
        {
            var result = ObjectSearchResults[i];
            var props = ObjectSearchResultsProperties[i];
            var LineNo = props.SearchForPropertyByAlias(Vault, "vProperty.POLine#", true).Value.DisplayValue;
            var Item = props.SearchForPropertyByAlias(Vault, "vProperty.POItem", true).Value.DisplayValue;
            var ItemNO=Item.split("=>");
            var ItemVal=ItemNO[0];
            var OrdQty = props.SearchForPropertyByAlias(Vault, "vProperty.OrderedQty", true).Value.DisplayValue;
            var RTDQty = props.SearchForPropertyByAlias(Vault, "vProperty.ReceivedQty", true).Value.DisplayValue;
            var Price = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.UnitPrice", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var Amount = '$' + props.SearchForPropertyByAlias(Vault, "vProperty.POLineExtension", true).Value.Value.toLocaleString('en-US', { minimumFractionDigits: 2 });
            var Account = props.SearchForPropertyByAlias(Vault, "vProperty.GLAccount", true).Value.DisplayValue;
            Total = Total + props.SearchForPropertyByAlias(Vault, "vProperty.POLineExtension", true).Value.Value
            TableBody.append(
                '<tr>' +
                '<td style="text-align:center"><span id="LineNumber">' + LineNo + '</span></td>' +
                '<td style="text-align:center" style="word-wrap:break-word;"><span id="ItemNumber">' + Item + '</span></td>' +
                '<td style="text-align:right"><span id="OrdQuantity">' + OrdQty + '</span></td>' +
                '<td style="text-align:right"><span id="RTDQuantity">' + RTDQty + '</span></td>' +
                '<td style="text-align:right"><span id="UnitPrice">' + Price + '</span></td>' +
                '<td style="text-align:right"><span id="Extension">' + Amount + '</span></td>' +
                '<td style="text-align:right"><span id="Account">' + Account + '</span></td>' +
                "</tr>"
            );
        }
        TableBody.append(
            '<tr>' +
            '<td colspan="5" style="border-bottom: none;border-left: none;">&nbsp;</td>' +
            '<td style="text-align:right">$' + Total.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
            '</tr>'
        );
    }
}

function SetPSDetails(controller)
{
    var editor=controller.PackingSlip;
    var Vault=controller.Vault;
    var tabname='PackingSlip';
    var tabdisplayname='Packing Slip';

    CreateMetadataCard(controller,editor,tabname,tabdisplayname);

    editor.table.append('<span>Packing Slip Details!</span>')

}

// A helper function to compile the search conditions needed for running the search in the
// vault using M-Files API.
function FindObjects(Vault,OTAlias,PDAlias,PDType,Value) {
    // We need a few IDs based on aliases defined in the M-Files Admin tool for object types, properties, etc.
    // Note that all these methods could be run asynchronously as well, if it seems they take a long time and block the UI.
    var OT = Vault.ObjectTypeOperations.GetObjectTypeIDByAlias(OTAlias);
    var PD = Vault.PropertyDefOperations.GetPropertyDefIDByAlias(PDAlias);

    var oSC = new MFiles.SearchCondition();
    var oSCs = new MFiles.SearchConditions();

    // Search condition that defines the object is not marked as deleted.
    oSC.ConditionType = MFConditionTypeEqual;
    oSC.Expression.SetStatusValueExpression(MFStatusTypeDeleted, new MFiles.DataFunctionCall());
    oSC.TypedValue.SetValue(MFDatatypeBoolean, false);
    oSCs.Add(-1, oSC);

    // Search condition that defines the object type 
    oSC.ConditionType = MFConditionTypeEqual;
    oSC.Expression.SetStatusValueExpression(MFStatusTypeObjectTypeID, new MFiles.DataFunctionCall());
    oSC.TypedValue.SetValue(MFDatatypeLookup, OT);
    oSCs.Add(-1, oSC);

    // Search condition that defines that the object must refer to the given object.
    oSC.ConditionType = MFConditionTypeEqual;
    oSC.Expression.DataPropertyValuePropertyDef = PD;
    oSC.TypedValue.SetValue(PDType, Value);
    oSCs.Add(-1, oSC);

    return oSCs;
}

function DisplayImage(Vault,ObjectVersionProperties)
{
	
	var ctrlContainer = $('div.panel-right');
	var filepath="";
	
	var DisplaySearchCondition = new MFiles.SearchCondition();
    var DisplaySearchConditions = new MFiles.SearchConditions();

	DisplaySearchCondition.ConditionType = MFConditionTypeEqual;
	DisplaySearchCondition.Expression.DataPropertyValuePropertyDef = Vault.PropertyDefOperations.GetPropertyDefIDByAlias("vProperty.InvoiceName")
	DisplaySearchCondition.TypedValue.SetValue(MFDatatypeText,ObjectVersionProperties[0].Value.DisplayValue);
	DisplaySearchConditions.Add(-1, DisplaySearchCondition); 

	 
	var DisplayResult = Vault.ObjectSearchOperations.SearchForObjectsByConditions(DisplaySearchConditions, MFSearchFlagNone, false);
	var doc = Vault.ObjectOperations.GetLatestObjectVersionAndProperties(DisplayResult[0].ObjVer.ObjID, false);
	var file = doc.VersionData.Files(1);
	filepath = Vault.ObjectFileOperations.GetPathInDefaultView(doc.VersionData.ObjVer.ObjID, doc.VersionData.ObjVer.Version, file.FileVer.ID, file.FileVer.Version);
	
	// EXTRA: Also show a preview of the document related to this Invoice object.
	// Add the ActiveX control to the DOM. Were are not using jQuery here to access the DOM, but would obviously
	// be an option. For details, see:
	// https://www.m-files.com/UI_Extensibility_Framework/#Embedding%20Shell%20Listings%20in%20Dashboards.html
	ctrlContainer.html('<object id="preview-ctrl" classid="clsid:' + MFiles.CLSID.PreviewerCtrl + '"> </object>');

	// Use the control to show the given file preview (path comes from whoever is embedding this dashboard, in this
	// case it is within a tab on shellFrame.RightPane).
	var previewCtrl = document.getElementById('preview-ctrl');
	previewCtrl.ShowFilePreview(filepath);		
//	ctrlContainer.html('<span>' + filepath + '</span>');
}

function isRequired(assocPropDefs,propertyNumber) { 
	for (var i = 0; i < assocPropDefs.Count; i++)
	{
		if (assocPropDefs[i].PropertyDef == propertyNumber)
			return assocPropDefs[i].Required;
	}
	return false;
}

function generate_row(tableID, Vault, ObjVerProperties, propertyAlias)
{
	var propertyNumber=ObjVerProperties.SearchForPropertyByAlias(Vault, propertyAlias, true).PropertyDef;
	var PropertyDef=Vault.PropertyDefOperations.GetPropertyDef(propertyNumber);
	var propertyName=PropertyDef.Name;
	var propertyType=PropertyDef.DataType;
	var propertyValue=ObjVerProperties.SearchForPropertyByAlias(Vault, propertyAlias, true).Value.DisplayValue;
	var propertyEditable=(PropertyDef.AutomaticValueType==0 ? 1 : 0);
	var classID=ObjVerProperties.SearchForProperty(MFBuiltInPropertyDefClass).TypedValue.getvalueaslookup().Item;
	var assocPropDefs=Vault.ClassOperations.GetObjectClass(classID).AssociatedPropertyDefs;
	var propertyRequired=isRequired(assocPropDefs,propertyNumber);
	if (propertyType==8)
		propertyValue=((propertyValue == 'Yes') ? 'Yes' : 'No');
	if (propertyType==3)
		propertyValue='$'+propertyValue;
    // Create container element
	var propertyLine=$('<tr>');
	propertyLine.addClass('mf-dynamic-row mf-property-'+propertyNumber);
    propertyLine.attr('id',propertyNumber)
    // Check if field is editable. If it is, add class 'mf-editable'
    if (propertyEditable)
    	propertyLine.addClass('mf-editable');
//	$(tableID).append(propertyLine);
	tableID.append(propertyLine);

	// Add hover handler (IE 10 css pseudo selector :hover is not detecting mouse leave events)
	propertyLine.hover(
		function() {

			// Set the hover theme. The special theme is set for workflow and workstates properties.
			$( this ).addClass( "ui-state-hover" );
			if( propertyNumber == 38 || propertyNumber == 99 )
				$( this ).addClass( "ui-footer-hover" );
		},
		function() {

			// Remove the hover theme, as well as the special theme workflow and workstate properties.
			$( this ).removeClass( "ui-state-hover" );
			if( propertyNumber == 38 || propertyNumber == 99 )
				$( this ).removeClass( "ui-footer-hover" );
		}
	);

    propertyLine.append(
        '        <td class="mf-dynamic-namefield">' +
        '            <div>' +
        '                <span class="mf-property-' + propertyNumber + '-label">' + propertyName + '</span>' +
        '                <span class="mf-required-indicator">*</span>' +
        '            </div>' +
        '        </td>' +
        '        <td class="mf-modify">&nbsp;</td>' +
        '        <td class="mf-dynamic-controlfield">' +
        '            <div class="mf-control mf-dynamic-control mf-text">' +
        '                <div class="mf-internal-container">' +
        '                    <div class="mf-internal-text mf-property-' + propertyNumber + '-text-0">' + propertyValue + '</div>' +
        '                </div>' +
        '            </div>' +
        '        </td>' +
        '        <td class="mf-dynamic-lastfield"></td>'
    );
    if (!propertyRequired)
        requiredspan=propertyLine.find('.mf-required-indicator').hide();
}

function setProperty(Vault, editor, propertyAlias)
{
    var ObjectVersionProperties=editor.ObjectVersionProperties
    var PropertyInfo=ObjectVersionProperties.SearchForPropertyByAlias(Vault, propertyAlias, true);
	var propertyNumber=PropertyInfo.PropertyDef;
	var PropertyDef=Vault.PropertyDefOperations.GetPropertyDef(propertyNumber);
	var propertyName=PropertyDef.Name;
	var propertyType=PropertyDef.DataType;
	var propertyValue=PropertyInfo.Value.DisplayValue;
	var propertyReadOnly=(PropertyDef.AutomaticValueType==0 ? false : true);
	var classID=ObjectVersionProperties.SearchForProperty(MFBuiltInPropertyDefClass).TypedValue.getvalueaslookup().Item;
	var assocPropDefs=Vault.ClassOperations.GetObjectClass(classID).AssociatedPropertyDefs;
	var propertyRequired=isRequired(assocPropDefs,propertyNumber);
	if (propertyType==8)
		propertyValue=((propertyValue == 'Yes') ? 'Yes' : 'No');
	if (propertyType==3)
		propertyValue='$'+propertyValue;

    var propertyObject={
        AllowAdding: false,
        Events: editor.Events,
        Hierarchical: false,
        ID: PropertyDef,
        Label: propertyName,
        Linked: false,
        Modified: false,
        MustExist: true,
        PropertyDef: PropertyDef,
        ReadOnly: propertyReadOnly,
        RealObjectType: false,
        RealOTHierarchical: false,
        RealOTHierarchy: false,
        Type: propertyType,
        Value: propertyValue,
        valuelist: -2,
        ValueRequired: propertyRequired,
        Visible: true
    };
    return propertyObject
}

function CreateMetadataCard(controller,editor,tabid,tabtitle)
{
    var Vault=controller.Vault;
    controller.editor=editor;
    if(typeof controller.cards === 'undefined')
        cardid=0;
    else
        cardid=controller.cards + 1;
    controller.cards=cardid;    

    editor.cardname='metadatacard-'+cardid;
    editor.tabname=tabid;
    editor.tabdisplayname=tabtitle;

    // Add the tab to the tab list
    $('<li><a href="#'+editor.tabname+'">'+editor.tabdisplayname+'</a></li>').appendTo("#tabs ul");
    $('<div id="'+editor.tabname+'"><div id="'+editor.cardname+'" class="mf-metadatacard mf-mode-properties"></div></div>').appendTo("#tabs");
    $("#tabs").tabs("refresh");

    // Add localization to the controller
    controller.localization = new localization();
    controller.getLocalization = function() {
    	return controller.localization;	
    };

    // Create and initialize metadatacard widget.
    var metadatacard = $('#'+editor.cardname);
    metadatacard.metadatacard({});
	// Enable configurability, disable logging.
    initParameters={ enableConfigurability: true, enableLogging: false }
    metadatacard.metadatacard("initialize", controller, initParameters);

    // Set initial metadata card mode to view mode. Don't try to update theme yet, because configuration data is not yet ready.
    //metadatacard.metadatacard( "setControlState", false, true, false );

	var MetaCard=$('div #'+editor.cardname);
    MetaCard.addClass( "mf-card-docked" );

    var mfcontentDiv=$('<div>');
	mfcontentDiv.addClass('mf-content');
    mfcontentDiv.css('height','600px');
    MetaCard.append(mfcontentDiv);

    var mfpropertiesviewDiv=$('<div>');
    mfpropertiesviewDiv.attr('id','mf-properties-view')
    mfcontentDiv.append(mfpropertiesviewDiv);

    var mfdynamiccontrolsDiv=$('<div>');
	mfdynamiccontrolsDiv.addClass('mf-dynamic-controls');
    mfpropertiesviewDiv.append(mfdynamiccontrolsDiv);

    var mfinternaldynamiccontrolsDiv=$('<div>');
	mfinternaldynamiccontrolsDiv.addClass('mf-internal-dynamic-controls');
    mfdynamiccontrolsDiv.append(mfinternaldynamiccontrolsDiv);

    var mfsectionDiv=$('<div>');
	mfsectionDiv.addClass('mf-section mf-section-properties');
    mfinternaldynamiccontrolsDiv.append(mfsectionDiv);

    var mfscrollableDiv=$('<div>');
	mfscrollableDiv.addClass('ui-scrollable');
    mfscrollableDiv.css('height','500px');
    mfsectionDiv.append(mfscrollableDiv);

    var mfsectioncontentDiv=$('<div>');
	mfsectioncontentDiv.addClass('mf-section-content mf-dynamic-properties');
    mfsectioncontentDiv.attr('id','a'+cardid);
    mfscrollableDiv.append(mfsectioncontentDiv);

    var mfdynamicTab=$('<table>');
	mfdynamicTab.addClass('mf-dynamic-table');
    mfdynamicTab.attr('id','mf-property-table');
    mfsectioncontentDiv.append(mfdynamicTab);

	// Bind click event to this element with 'metadatacard' namespace.
	MetaCard.bind( "click.metadatacard", function( event ) {
alert("Card Clicked!!!");
//		self.editManager.requestEditMode( null );
	} );

    editor.metadatacard=MetaCard;
	editor.table=$('div #'+editor.cardname+' #mf-property-table');
}
