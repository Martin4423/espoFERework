<?php

namespace Espo\Custom\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Tools\LeadCapture\FormService;

class GetLeadCaptureFormData implements Action
{
    public function __construct(
        private FormService $formService,
    ) {}

    public function process(Request $request): Response
    {
        $id = $request->getRouteParam('id') ?? throw new BadRequest();
        [, $data] = $this->formService->getData($id);

        return ResponseComposer::json($data);
    }
}
