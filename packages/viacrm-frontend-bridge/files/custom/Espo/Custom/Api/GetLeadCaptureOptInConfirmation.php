<?php

namespace Espo\Custom\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Tools\LeadCapture\CaptureService;

class GetLeadCaptureOptInConfirmation implements Action
{
    public function __construct(
        private CaptureService $captureService,
    ) {}

    public function process(Request $request): Response
    {
        $id = $request->getRouteParam('id') ?? throw new BadRequest();
        $result = $this->captureService->confirmOptIn($id);

        return ResponseComposer::json([
            'status' => $result->getStatus(),
            'message' => $result->getMessage(),
            'leadCaptureId' => $result->getLeadCaptureId(),
            'leadCaptureName' => $result->getLeadCaptureName(),
        ]);
    }
}
